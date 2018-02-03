# fakegato-history
Module to emulate Elgato Eve history service in Homebridge accessories, so that it will show in Eve.app (Home.app does not support it). Still work in progress. Use at your own risk, no guarantee is provided.

More details on communication protocol and custom Characteristics here: https://gist.github.com/simont77/3f4d4330fa55b83f8ca96388d9004e7d

Your plugin should expose the corresponding custom Elgato services and characteristics in order for the history to be seen in Eve.app. For a weather example see https://github.com/simont77/homebridge-weather-station-extended, for energy, motion and door example see https://github.com/simont77/homebridge-myhome/blob/master/index.js (MHPowerMeter and MHDryContact classes). For other types see the gist above.
Note that if your Eve.app is controlling more than one accessory for each type, the serial number should be unique, otherwise Eve.app will merge the histories.  Including hostname is recommended as well, for running multiple copies of the same plugin on different machines (i.e. production and development), i.e.:

    .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.deviceID)

Import module into your plugin module export with:

    var FakeGatoHistoryService = require('fakegato-history')(homebridge);

Add the service to your Accessory using:

    Accessory.log = this.log;
    this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, length);

And if your plugin is using V2 of the platform API, also add the above to your configureAccessory function as well.

where

- accessoryType can be "weather", "energy", "room", "door", motion" or "thermo"
- Accessory should be the accessory using the service, in order to correctly set the service name and pass the log to the parent object. Your Accessory should have a `this.log` variable pointing to the homebridge logger passed to the plugin constructor (add a line `this.log=log;` to your plugin). Debug messages will be shown if homebridge is launched with -D option.
- length is the history length; if no value is given length is set to 4032 samples

Remember to return the fakagato service in getServices function if using the accessory API, and if using the platform API include it as a Service as part of your accessory.

Eve.app requires at least an entry every 10 minutes to avoid holes in the history. Depending on the accessory type, fakegato-history may add extra entries every 10 minutes or may average the entries from the plugin and send data every 10 minutes. This is done using a single global timer shared among all accessories using fakegato. You may opt for managing yourself the Timer and disabling the embedded one by using that constructor:
```
	this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {size:length,disableTimer:true});
```
then you'll have to addEntry yourself data every 10min.

Depending on your accessory type:

* Add entries to history of accessory emulating **Eve Weather** (TempSensor Service) using something like this:

		this.loggingService.addEntry({time: moment().unix(), temp:this.temperature, pressure:this.airPressure, humidity:this.humidity});

	AirPressure is in mbar, Temperature in Celsius, Humidity in %. Entries are internally averaged and sent every 10 minutes using the global fakegato timer. Your entries should be in any case periodic, in order to avoid error with the average. Average is done independently on each quantity (i.e. you may different periods, and entries with only one or two quantities)

* Add entries to history of accessory emulating **Eve Energy** (Outlet service) using something like this:

		this.loggingService.addEntry({time: moment().unix(), power: this.power});

	Power is in Watt. Entries are internally averaged and sent every 10 minutes using the global fakegato timer. To have good accuracy, your entries should be in any case periodic, in order to avoid error with the average.

* Add entries to history of accessory emulating **Eve Room** (TempSensor, HumiditySensor and AirQuality Services) using something like this:

		this.loggingService.addEntry({time: moment().unix(), temp:this.temperature, humidity:this.humidity, ppm:this.ppm});

	Temperature in Celsius, Humidity in %. Entries are internally averaged and sent every 10 minutes using the global fakegato timer. Your entries should be in any case periodic, in order to avoid error with the average. Average is done independently on each quantity (i.e. you may different periods, and entries with only one or two quantities)

* Add entries to history of accessory emulating **Eve Door** (ContactSensor service) using something like this on every status change:

		this.loggingService.addEntry({time: moment().unix(), status: this.status});

	Status can be 1 for ‘open’ or 0 for ‘close’. Entries are of type "event", so entries received from the plugin will be added to the history as is. In addition to that, fakegato will add extra entries every 10 minutes repeating the last known state, in order to avoid the appearance of holes in the history.

* Add entries to history of accessory emulating **Eve Motion** (MotionSensor service) using something like this on every status change:

		this.loggingService.addEntry({time: moment().unix(), status: this.status});

	Status can be 1 for ‘detected’ or 0 for ‘cleared’. Entries are of type "event", so entries received from the plugin will be added to the history as is. In addition to that, fakegato will add extra entries every 10 minutes repeating the last known state, in order to avoid the appearance of holes in the history.

* Add entries to history of accessory emulating **Eve Thermo** (Thermostat service) using something like this every 10 minutes:

		this.loggingService.addEntry({time: moment().unix(), currentTemp:this.currentTemp, setTemp:this.setTemp, valvePosition:this.valvePosition});

	currentTemp and setTemp in Celsius, valvePosition in %. Fakegato does not use the internal timer for Thermo, entries are added to the history as received from the plugin (Thermo accessory is under development). For setTemp to show, you have to add all the 3 extra thermo characteristics (see gist), and enable set temperature visualization under accessory options in Eve.app.

For Energy and Door accessories it is also worth to add the custom characteristic E863F112 for resetting, respectively, the Total Consumption accumulated value or the Aperture Counter (not the history). See the gist above. The value of this characteristic is changed whenever the reset button is tapped on Eve, so it can be used to reset the locally stored value. The value seems to be the number of seconds from 1.1.2001. I left this characteristics out of fakegato-history because it is not part of the common  history service.

If your "weather" or "room" plugin don't send addEntry for a short time (supposedly less than 1h - need feedback), the graph will draw a straight line from the last data received to the new data received. Instead, if your plugin don't send addEntry for "weather" and "room" for a long time (supposedly more than few hours - need feedback), the graph will show "no data for the period". Take this in consideration if your sensor does not send entries if the difference from the previuos one is small, you will end up with holes in the history. This is not currently addresses by fakegato, you should add extra entries if needed. Note that if you do not send a new entry at least every 10 minutes, the average will be 0, and you will a zero entry. This will be fixed soon.

### History Persistance

It is possible to persist data to disk or to Google Drive to avoid loosing part of the history not yet downloaded by Eve on restart or system crash. Data is saved every 10min for "weather" and "room", on every event and every 10 minutes for "door" and "motion", on every event for other types.

#### File System
In order to enable persistance on local disk, when instantiating the FakeGatoHistoryService, the third argument become an object with these attributes:
```
this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {
	size:length, 				// optional - if you still need to specify the length
	storage:'fs',
	path:'/place/to/store/my/persistence/'  // if empty it will be used the -U homebridge option if present or .homebridge
});
```
Data will be saved in json files, one for each persisted accessory, with filename in the form *hostname_accessoryDisplayName_persist.json*. In order to reset the persisted data, simply delete these files. 

#### Google Drive
In order to enable persistance on Google Drive, when instantiating the FakeGatoHistoryService, the third argument become an object with these attributes :
```
this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {
	size:length, 				// optional - if you still need to specify the length
	storage:'googleDrive',
	folder:'fakegatoFolder', 		// folder on Google drive to persist data, 'fakegato' if empty
	keyPath:'/place/to/store/my/keys/' 	// where to find client_secret.json, if empty it will be used the -U homebridge option if present or .homebridge
});
```
For the setup of Google Drive, please follow the Google Drive Quickstart for Node.js instructions from https://developers.google.com/drive/v3/web/quickstart/nodejs, except for these changes:
* In Step 1-h the working directory should be the .homebridge directory
* Skip Step 2 and 3
* In step 4, use the quickstartGoogleDrive.js included with this module. You need to run the command from fakegato-hisory directory. Then just follow steps a to c.

##### Additional notes for Google Drive
* The folder in which you want to save the persisted data must be already present on Google Drive
* Pay attention so that your plugin does not issue multiple addEntry calls for the same accessory at the same time (this may results in unproper behaeviour of Google Drive to the its asynchronous nature)

### TODO

- [x] Support for rolling-over of the history
- [x] Aggregate transmission of several entries into a single Characteristic update in order to speed up transfer when not on local network.
- [x] Add other accessory types. Help from people with access to real Eve accessory is needed. Dump of custom Characteristics during data transfer is required.
- [x] Make history persistent
- [x] Adjustable history length
- [ ] Addition and management of other history related characteristics
- [ ] Periodic sending of reference time stamp (seems not really needed if the time of your homebridge machine is correct)

### Known bugs

- Currently valve position history in thermo is not working
- ~~In "weather" and "room" if you do not send at least an entry every 10 minutes you will get zeros in the history.~~

### How to contribute

If you own an Eve accessory and would like to help improving this module, you can follow this procedure to dump the communication:

- Install Xcode on a Mac with High Sierra and register for a free Apple Developer Account
- Download this code https://github.com/simont77/HMCatalog-Swift3/tree/experimental and compile the HMCatalog app. Follow this guide https://stackoverflow.com/questions/30973799/ios-9-new-feature-free-provisioning-run-your-app-on-a-device-just-with-your-ap to compile for your own device and install on it (the app will not work on any other device). The App will run only for few days, since the code signature has a very short expiration date, but you can repeat the procedure if needed. This is called Free Provisioning, you may find many additional guides on the web in case of issues. You will have also to enable Homekit support, let Xcode fix issues when it offers to do it.
- Run the HMCatalog app. You should be able to read raw values of all the characteristics of your accessories.
- Trigger an history transfer of the history within Eve.app
- Open again the HMCatalog app, select your Eve accessory and the Service E863F007-079E-48FF-8F27-9C2605A29F52. If using an iPad you can open HMCatalog and Eve in split view to monitor in real time the communication as it occurs.
- Copy values of all characteristics (especially E863F117-079E-48FF-8F27-9C2605A29F52 and E863F116-079E-48FF-8F27-9C2605A29F52) and leave me a comment with it.
