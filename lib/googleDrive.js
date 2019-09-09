/* jshint esversion: 6,node: true,-W041: false */
'use strict';
var debug = require('debug')('FakeGatoStorageDrive');
var fs = require('fs');
var readline = require('readline');

const {google} = require('googleapis');
var path = require('path');
var os = require('os');

module.exports = {
  drive: drive
};

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = path.join((process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE || os.homedir()), '.homebridge');
var TOKEN_PATH = path.join(TOKEN_DIR, 'drive-nodejs-quickstart.json');
var SECRET_PATH = path.join(TOKEN_DIR, 'client_secret.json');
var auth;

function drive(params) {
  if (params && params.keyPath) {
    TOKEN_DIR = params.keyPath;
    TOKEN_PATH = path.join(TOKEN_DIR, 'drive-nodejs-quickstart.json');
    SECRET_PATH = path.join(TOKEN_DIR, 'client_secret.json');
  }

  // Load client secrets from a local file.
  fs.readFile(SECRET_PATH, function processClientSecrets(err, content) {
    if (err) {
      console.log('Error loading client secret file, please follow the instructions in the README!!!', err);
      return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Drive API.
    authorize(JSON.parse(content), function(authenticated) {
      auth = authenticated;
      debug("Authenticated", content, params);
      if (params) {
        if (params.folder) {
          getFolder(params.folder, params.callback); // create if not exists (always callback)
        } else {
          if (typeof (params.callback) === 'function') {
            params.callback();
          }
        }
      }
    });
  });
}

drive.prototype.writeFile = function(folder, name, data, cb) {
  // get folder ID
  if (auth) {
    if (this.updating !== true) {
      this.updating = true;
      // debug("getFolder",folder);
      getFolder(folder, function(err, folder) {
        // debug("upload",name);
        if (err) {
          debug("writeFile - Can't get folder", err);
          this.updating = false;
          cb();
        } else {
          myUploadFile(folder, name, data, function() {
            this.updating = false;
            cb(arguments);
          }.bind(this));
        }
      }.bind(this));
    } else {
      setTimeout(function() {
        this.writeFile(folder, name, data, cb);
      }.bind(this), 100);
    }
  } else {
    debug("NO AUTH YET (Not normal)");
    setTimeout(function() {
      this.writeFile(folder, name, data, cb);
    }.bind(this), 100);
  }
};

drive.prototype.readFile = function(folder, name, cb) {
  if (auth) {
    // debug("getFolder",folder);
    getFolder(folder, function(err, folder) {
      if (err) {
        debug("getFolder retry %s/%s", folder, name);
        setTimeout(function() {
          this.readFile(folder, name, cb);
        }.bind(this), 100);
      } else {
        debug("download %s/%s", folder, name);
        myDownloadFile(folder, name, cb);
      }
    }.bind(this));
  } else {
    debug("NO AUTH YET (Not normal)");
    setTimeout(function() {
      this.readFile(folder, name, cb);
    }.bind(this), 100);
  }
};

drive.prototype.deleteFile = function(folder, name, cb) {
  if (auth) {
    // debug("getFolder",folder);
    getFolder(folder, function(err, folder) {
      debug("delete", name);
      myDeleteFile(folder, name, cb);
    });
  } else {
    debug("NO AUTH YET (Not normal)");
    setTimeout(function() {
      this.deleteFile(folder, name, cb);
    }.bind(this), 100);
  }
};

function getFolder(folder, cb) {
  var drive = google.drive('v3');
  //    debug("getFolder",folder);
  drive.files.list({
    q: "mimeType='application/vnd.google-apps.folder' and name = '" + folder + "' and trashed = false",
    fields: 'nextPageToken, files(id, name)',
    spaces: 'drive',
    auth: auth
  }, function(err, res) {
    if (err) {
      debug("getFolder - err", err);
      cb(err, folder);
    } else {
      if (res.data.files.length > 0) {
        if (res.data.files.length > 1) {
          debug("Multiple folders with same name, taking the first one", folder, 'in', res.data.files);
        }
        //      debug('Found Folder: ', res.files[0].name, res.files[0].id);
        cb(null, res.data.files[0].id);
      } else {
        var fileMetadata = {
          'name': folder,
          'mimeType': 'application/vnd.google-apps.folder'
        };
        drive.files.create({
          resource: fileMetadata,
          fields: 'id',
          auth: auth
        }, function(err, file) {
          if (err) {
            // Handle error
            debug(err);
          } else {
            debug("Created Folder", file.id);
            cb(null, file.id);
          }
        });
      }
    }
  });
}

function getFileID(folder, name, cb) {
  var drive = google.drive('v3');
  // debug("GET FILE ID : %s/%s",folder,name);
  drive.files.list({
    q: "name = '" + name + "' and trashed = false and '" + folder + "' in parents",
    fields: 'files(id, name)',
    spaces: 'drive',
    // parents: [folder],
    auth: auth
  }, function(err, result) {
    // debug("GET FILE ID result",result,err);
    cb(err, result);
  });
}

function myUploadFile(folder, name, data, cb) {
  var drive = google.drive('v3');
  //    debug("upload File %s\%s", folder, name);
  var fileMetadata = {
    'name': name,
    parents: [folder]
  };
  var media = {
    mimeType: 'application/json',
    body: JSON.stringify(data)
  };
  getFileID(folder, name, function(err, result) {
    // debug("fileID for %s/%s is :",folder,name,result,err);
    if (result && result.data.files && result.data.files.length > 0) {
      drive.files.update({
        fileId: result.data.files[0].id,
        media: media,
        auth: auth
      }, function(err, file) {
        if (err) {
          debug('FILEUPDATE :', err);
        } else {
          debug('myUploadFile - update success', name);
        }
        cb(err, file);
      });
    } else {
      debug("no file found, creating", name, fileMetadata, media);
      drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
        auth: auth
      }, function(err, file) {
        if (err) {
          debug('FILECREATE :', file, err);
        } else {
          debug('myUploadFile - create success', name);
        }
        cb(err, file);
      });
    }
  });
}

function myDownloadFile(folder, name, cb) {
  var drive = google.drive('v3');

  debug("download file", folder, name);

  getFileID(folder, name, function(err, result) {
    if (result && result.data.files && result.data.files.length) {
      if (result.data.files.length > 1) {
        debug("Multiple files with same name, taking the first one", name, 'in', result.data.files);
      }
      drive.files.get({
        fileId: result.data.files[0].id,
        alt: 'media',
        auth: auth
      }, function(err, success) {
        if (err) debug("ERROR downloading", err);
        else debug("SUCCESS downloading", name);
        cb(err, success.data);
      });
    } else {
      debug("no file found", name);
      cb(new Error("File not found"), false);
    }
  });
}

function myDeleteFile(folder, name, cb) {
  var drive = google.drive('v3');

  debug("delete file", folder, name);

  getFileID(folder, name, function(err, result) {
    if (result && result.data.files && result.data.files.length) {
      if (result.data.files.length > 1) {
        debug("Multiple files with same name, taking the first one", name, 'in', result.data.files);
      }
      drive.files.delete({
        fileId: result.data.files[0].id,
        auth: auth
      }, function(err, success) {
        if (err) debug("ERROR deleting", err);
        else debug("SUCCESS deleting", success);
        cb(err, success);
      });
    } else {
      debug("no file found", name);
      cb(null, false);
    }
  });
}

// This is all from the Google Drive Quickstart

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oAuth2Client, callback);
    } else {
      oAuth2Client.credentials = JSON.parse(token);
      callback(oAuth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oAuth2Client, callback) {
  var authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oAuth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oAuth2Client.credentials = token;
      storeToken(token);
      callback(oAuth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
    if (err) throw err;
    console.log('Token stored to ' + TOKEN_PATH);
  });
}

/**
 * Lists the names and IDs of up to 10 files.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
  var drive = google.drive('v3');
  drive.files.list({
    auth: auth,
    pageSize: 30,
    fields: "nextPageToken, files(id, name)"
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var files = response.files;
    if (files.length === 0) {
      debug('No files found.');
    } else {
      debug('Files:');
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        debug('%s (%s)', JSON.stringify(file, null, 2), file.name, file.id);
      }
    }
  });
}

function uploadFile(auth) {
  var drive = google.drive('v3');

  var fetchPage = function(pageToken, pageFn, callback) {
    drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and name = 'Camera Pictures'",
      fields: 'nextPageToken, files(id, name)',
      spaces: 'drive',
      pageToken: pageToken,
      auth: auth
    }, function(err, res) {
      if (err) {
        callback(err);
      } else {
        res.files.forEach(function(file) {
          debug('Found file: ', file.name, file.id);
        });
        if (res.nextPageToken) {
          debug("Page token", res.nextPageToken);
          pageFn(res.nextPageToken, pageFn, callback);
        } else {
          callback();
        }
      }
    });
  };
  fetchPage(null, fetchPage, function(err) {
    if (err) {
      // Handle error
      console.log(err);
    } else {
      // All pages fetched
    }
  });

  var fileMetadata = {
    'name': 'Camera Pictures',
    'mimeType': 'application/vnd.google-apps.folder'
  };
  drive.files.create({
    resource: fileMetadata,
    fields: 'id',
    auth: auth
  }, function(err, file) {
    if (err) {
      // Handle error
      console.log(err);
    } else {
      debug('Folder Id: ', file.id);

      var fileMetadata = {
        'name': 'photo.jpg',
        parents: [file.id]
      };
      var media = {
        mimeType: 'image/jpeg',
        body: fs.createReadStream('photo.jpg')
      };

      drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id',
        auth: auth
      }, function(err, file) {
        if (err) {
          // Handle error
          console.log(err);
        } else {
          debug('File Id: ', file.id);
        }
      });
    }
  });
}
