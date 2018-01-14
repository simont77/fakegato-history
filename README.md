# fakegato-history
Module to emulate Elgato Eve history service in Homebridge accessories, so that it will show in Eve.app (Home.app does not support it). Still work in progress. Use at your own risk, no guarantee is provided.

More details on communication protocol and custom Characteristics here: https://gist.github.com/simont77/3f4d4330fa55b83f8ca96388d9004e7d

Your plugin should expose the corresponding custom Elgato services and characteristics in order for the history to be seen in Eve.app. For a weather example see https://github.com/simont77/homebridge-weather-station-extended, for an energy example see https://github.com/simont77/homebridge-myhome/blob/master/index.js (MHPowerMeter class). For other types see the gist above.
Note that if your Eve.app is controlling more than one accessory for each type, the serial number should be unique, otherwise Eve.app will merge the histories.  Including hostname is recommended as well, for running multiple copies of the same plugin on different machines ( ie production and development ).  ie

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

Eve.app requires at least an entry every 10 minutes to avoid holes in the history. Depending on the accessory type, fakegato-history may add extra entries every 10 minutes or may average the entries from the plugin and send data every 10 minutes. This is done using a single global timer shared among all accessories using fakegato.

Depending on your accessory type:

* Add entries to history of accessory emulating **Eve Weather** (TempSensor Service) using something like this:

		this.loggingService.addEntry({time: moment().unix(), temp:this.temperature, pressure:this.airPressure, humidity:this.humidity});

	AirPressure is in mbar, Temperature in Celsius, Humidity in %. Entries are internally averaged and sent every 10 minutes using the global fakegato timer. Your entries should be in any case periodic, in order to avoid error with the average. Average is done independently on each quantity (i.e. you may different periods, and entries with only one or two quantities)

* Add entries to history of accessory emulating **Eve Energy** (Outlet service) using something like this every 10 minutes:

		this.loggingService.addEntry({time: moment().unix(), power: this.power});

	Power should be the average power in W over 10 minutes period. To have good accuracy, it is strongly advised not to use a single instantaneous measurement, but to average many few seconds measurements over 10 minutes. Fakegato does not use the internal timer for Energy, entries are added to the history as received from the plugin (this is done because the plugin may already have its own average for TotalComsumption calculation)

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

	currentTemp and setTemp in Celsius, valvePosition in %. Fakegato does not use the internal timer for Energy, entries are added to the history as received from the plugin (Thermo accessory this under development). For setTemp to show, you have to add all the 3 extra thermo characteristics (see gist), and enable set temperature visualization under accessory options in Eve.app.


For Energy and Door accessories it is also worth to add the custom characteristic E863F112 for resetting, respectively, the Total Consumption accumulated value or the Aperture Counter (not the history). See the gist above. The value of this characteristic is changed whenever the reset button is tapped on Eve, so it can be used to reset the locally stored value. The value seems to be the number of seconds from 1.1.2001. I left this characteristics out of fakegato-history because it is not part of the common  history service.

If your "weather" or "room" plugin don't send addEntry for a short time (supposedly less than 1h - need feedback), the graph will draw a straight line from the last data received to the new data received. Instead, if your plugin don't send addEntry for "weather" and "room" for a long time (supposedly more than few hours - need feedback), the graph will show "no data for the period". Take this in consideration if your sensor does not send entries if the difference from the previuos one is small, you will end up with holes in the history. This is not currently addresses by fakegato, you should add extra entries if needed.

### TODO

- [x] Support for rolling-over of the history
- [x] Aggregate transmission of several entries into a single Characteristic update in order to speed up transfer when not on local network.
- [x] Add other accessory types. Help from people with access to real Eve accessory is needed. Dump of custom Characteristics during data transfer is required.
- [ ] Make history persistent
- [x] Adjustable history length
- [ ] Periodic sending of reference time stamp (seems not really needed if the time of your homebridge machine is correct)

### Known bugs
~~- Currenly not fully compatible with dynamic Platforms using Homebridge API v2 format.~~
- Currently valve position history in thermo is not working

### How to contribute

If you own an Eve accessory and would like to help improving this module, you can follow this procedure to dump the communication:

- Install Xcode on a Mac with High Sierra and register for a free Apple Developer Account
- Download this code https://github.com/simont77/HMCatalog-Swift3/tree/experimental and compile the HMCatalog app. Follow this guide https://stackoverflow.com/questions/30973799/ios-9-new-feature-free-provisioning-run-your-app-on-a-device-just-with-your-ap to compile for your own device and install on it (the app will not work on any other device). The App will run only for few days, since the code signature has a very short expiration date, but you can repeat the procedure if needed. This is called Free Provisioning, you may find many additional guides on the web in case of issues. You will have also to enable Homekit support, let Xcode fix issues when it offers to do it.
- Run the HMCatalog app. You should be able to read raw values of all the characteristics of your accessories.
- Trigger an history transfer of the history within Eve.app
- Open again the HMCatalog app, select your Eve accessory and the Service E863F007-079E-48FF-8F27-9C2605A29F52. If using an iPad you can open HMCatalog and Eve in split view to monitor in real time the communication as it occurs.
- Copy values of all characteristics (especially E863F117-079E-48FF-8F27-9C2605A29F52 and E863F116-079E-48FF-8F27-9C2605A29F52) and leave me a comment with it.
