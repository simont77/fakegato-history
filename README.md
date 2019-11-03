# fakegato-history
[![npm](https://img.shields.io/npm/v/fakegato-history.svg?style=plastic)](https://www.npmjs.com/package/fakegato-history)
[![npm](https://img.shields.io/npm/dt/homebridge-weather-station-extended.svg?style=plastic)](https://www.npmjs.com/package/fakegato-history)
[![GitHub last commit](https://img.shields.io/github/last-commit/simont77/fakegato-history.svg?style=plastic)](https://github.com/simont77/fakegato-history)
[![GitHub license](https://img.shields.io/github/license/simont77/fakegato-history.svg?style=plastic)](https://github.com/simont77/fakegato-history)

Module to emulate Elgato Eve history service in Homebridge accessories, so that it will show in Eve.app (Home.app does not support it). Still work in progress. Use at your own risk, no guarantee is provided.

**NOTE when updating from version <0.5.0:** On certain systems (e.g. macOS), previus versions may append ".local" or ".lan" after *hostname* in the file name. This additional portions are now removed to improve reliability of persistence on google drive when network goes down. If you do not want to loose your previous history, before updating check if your system creates files with the additional portion, and if so, rename them.

More details on communication protocol and custom Characteristics in the Wiki.

Your plugin should expose the corresponding custom Elgato services and characteristics in order for the history to be seen in Eve.app. For a weather example see https://github.com/simont77/homebridge-weather-station-eve, for an energy example see https://github.com/simont77/homebridge-myhome/blob/master/index.js (MHPowerMeter class). For other types see the Wiki.
Avoid the use of "/" in characteristics of the Information Service (e.g. serial number, manufacturer, etc.), since this may cause data to not appear in the history. Note that if your Eve.app is controlling more than one accessory for each type, the serial number should be unique, otherwise Eve.app will merge the histories. Adding hostname is recommended as well, for running multiple copies of the same plugin on different machines (i.e. production and development), i.e.:

    .setCharacteristic(Characteristic.SerialNumber, hostname + "-" + this.deviceID)

Import module into your plugin module export with:

    var FakeGatoHistoryService = require('fakegato-history')(homebridge);

Add the service to your Accessory using:

    Accessory.log = this.log;
    this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, length);

And if your plugin is using V2 of the platform API, also add the above to your configureAccessory function as well.

where

- accessoryType can be "weather", "energy", "room", "door", motion", "switch", "thermo" or "aqua"
- Accessory should be the accessory using the service, in order to correctly set the service name and pass the log to the parent object. Your Accessory should have a `this.log` variable pointing to the homebridge logger passed to the plugin constructor (add a line `this.log=log;` to your plugin). Debug messages will be shown if homebridge is launched with -D option.
- length is the history length; if no value is given length is set to 4032 samples

Remember to return the fakegato service in getServices function if using the accessory API, and if using the platform API include it as a Service as part of your accessory.

Eve.app requires at least an entry every 10 minutes to avoid holes in the history. Depending on the accessory type, fakegato-history may add extra entries every 10 minutes or may average the entries from the plugin and send data every 10 minutes. This is done using a single global timer shared among all accessories using fakegato. You may opt for managing yourself the Timer and disabling the embedded one by using that constructor:
```
	this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {size:length,disableTimer:true});
```
then you'll have to addEntry yourself data every 10min.

By default, if you don't addEntry during the 10 minutes timer, to avoid gaps (and fill data for lazy sensors), the timer repeat the last data. To avoid this behaviour, add the `disableRepeatLastData` param :
```
	this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {size:length,disableRepeatLastData:true});
```

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

* Add entries to history of accessory emulating **Eve Light Switch** (Switch service) using something like this on every status change:

		this.loggingService.addEntry({time: moment().unix(), status: this.status});

	Status can be 1 for ‘On’ or 0 for ‘Off’. Entries are of type "event", so entries received from the plugin will be added to the history as is. In addition to that, fakegato will add extra entries every 10 minutes repeating the last known state, in order to avoid the appearance of holes in the history.

* Add entries to history of accessory emulating **Eve Thermo** (Thermostat service) using something like this every 10 minutes:

		this.loggingService.addEntry({time: moment().unix(), currentTemp:this.currentTemp, setTemp:this.setTemp, valvePosition:this.valvePosition});

	currentTemp and setTemp in Celsius, valvePosition in %. Fakegato does not use the internal timer for Thermo, entries are added to the history as received from the plugin (Thermo accessory is under development). For setTemp to show, you have to add all the 3 extra thermo characteristics (see gist), and enable set temperature visualization under accessory options in Eve.app.
	
* Add entries to history of accessory emulating **Eve Aqua** (Valve service set to Irrigation Type) using something like this on every status change:

		this.LoggingService.addEntry({ time: moment().unix(), status: this.power, waterAmount:this.waterAmount });

	Status can be 1 for ‘open’ or 0 for ‘close’. WaterAmount is meaningful (and needed) only when Status is close, and corresponds to the amount of water used during the just elapsed irrigation period in ml. Entries are of type "event", so entries received from the plugin will be added to the history as is. In addition to that, fakegato will add extra entries every 10 minutes repeating the last known state, in order to avoid the appearance of holes in the history.

For Energy and Door accessories it is also worth to add the custom characteristic E863F112 for resetting, respectively, the Total Consumption accumulated value or the Aperture Counter (not the history). See Wiki. The value of this characteristic is changed whenever the reset button is tapped on Eve, so it can be used to reset the locally stored value. The value seems to be the number of seconds from 1.1.2001. I left this characteristics out of fakegato-history because it is not part of the common  history service.

For Door and Motion you may want to add characteristic E863F11A for setting the time of last activation. Value is the number of second from reset of fakegato-history. You can get this time using the function *getInitialTime()*

For Aqua you need to add E863F131 and E863F11D characteristics in order to make Eve recognize the accessory, and to set last activation, total water consumption and flux (see wiki). You MUST also set a proper value in E863F131, even if your plugin does not actively set these quantities, otherwise Eve will not communicate properly. See wiki for an example proper value.

If your "weather" or "room" plugin don't send addEntry for a short time (supposedly less than 1h - need feedback), the graph will draw a straight line from the last data received to the new data received. Instead, if your plugin don't send addEntry for "weather" and "room" for a long time (supposedly more than few hours - need feedback), the graph will show "no data for the period". Take this in consideration if your sensor does not send entries if the difference from the previous one is small, you will end up with holes in the history. This is not currently addresses by fakegato, you should add extra entries if needed. Note that if you do not send a new entry at least every 10 minutes, the average will be 0, and you will a zero entry. This will be fixed soon.

### History Persistence

It is possible to persist data to disk or to Google Drive to avoid loosing part of the history not yet downloaded by Eve on restart or system crash. Data is saved every 10min for "weather" and "room", on every event and every 10 minutes for "door" and "motion", on every event for other types.

Data will be saved, either on local filesystem or on google drive, in JSON files, one for each persisted accessory, with filename in the form *hostname_accessoryDisplayName_persist.json*. In order to reset the persisted data, simply delete these files.

**NOTE when updating from version <0.5.0:** On certain systems (e.g. macOS), previus versions may append ".local" or ".lan" after *hostname* in the file name. This additional portions are now removed to improve reliability of persistence on google drive when network goes down. If you do not want to loose your previous history, before updating check if your system creates files with the additional portion, and if so, rename them.

As an added feature, plugins can leverage persistance capabilities of fakegato, both on filesystem and google drive, using the two functions *setExtraPersistedData(extra)* and *getExtraPersistedData()*. Extra can be any json formattable data. Plugin has to check that what is returned is what it is expecting (fakegato will return undefined object if extra data is not present on the persisted file, or if google drive has not started yet), and retry if needed. It is also advisable to call in advance the function *isHistoryLoaded()* to check whether fakegato finished loading the history from the storage.

#### File System
In order to enable persistence on local disk, when instantiating the FakeGatoHistoryService, the third argument become an object with these attributes:
```
this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, {
	size:length, 				// optional - if you still need to specify the length
	storage:'fs',
	path:'/place/to/store/my/persistence/'  // if empty it will be used the -U homebridge option if present, or .homebridge in the user's home folder
});
```

#### Google Drive
In order to enable persistence on Google Drive, when instantiating the FakeGatoHistoryService, the third argument become an object with these attributes:
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
* In step 4, use the quickstartGoogleDrive.js included with this module. You need to run the command from fakegato-history directory. Then just follow steps a to c.

##### Additional notes for Google Drive
* Pay attention so that your plugin does not issue multiple addEntry calls for the same accessory at the same time (this may results in improper behaviour of Google Drive to the its asynchronous nature)

## TODO

- [x] Support for rolling-over of the history
- [x] Aggregate transmission of several entries into a single Characteristic update in order to speed up transfer when not on local network.
- [x] Add other accessory types. Help from people with access to real Eve accessory is needed. Dump of custom Characteristics during data transfer is required.
- [x] Make history persistent
- [x] Adjustable history length
- [ ] Addition and management of other history related characteristics
- [ ] Periodic sending of reference time stamp (seems not really needed if the time of your homebridge machine is correct)

## Known bugs

- Currently valve position history in thermo is not working

## How to contribute

If you own an Eve accessory and would like to help improving this module, you can follow this procedure to dump the communication:

- Install Xcode on a Mac with High Sierra and register for a free Apple Developer Account
- Download this code https://github.com/simont77/HMCatalog-Swift3/tree/experimental and compile the HMCatalog app. Follow this guide https://stackoverflow.com/questions/30973799/ios-9-new-feature-free-provisioning-run-your-app-on-a-device-just-with-your-ap to compile for your own device and install on it (the app will not work on any other device). The App will run only for few days, since the code signature has a very short expiration date, but you can repeat the procedure if needed. This is called Free Provisioning, you may find many additional guides on the web in case of issues. You will have also to enable Homekit support, let Xcode fix issues when it offers to do it.
- Run the HMCatalog app. You should be able to read raw values of all the characteristics of your accessories.
- Trigger an history transfer of the history within Eve.app
- Open again the HMCatalog app, select your Eve accessory and the Service E863F007-079E-48FF-8F27-9C2605A29F52. If using an iPad, you can open HMCatalog and Eve in split view to monitor in real time the communication as it occurs.
- Copy values of all characteristics (especially E863F117-079E-48FF-8F27-9C2605A29F52 and E863F116-079E-48FF-8F27-9C2605A29F52) and leave me a comment with it.
