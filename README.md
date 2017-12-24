# fakegato-history
Module to emulate Elgato Eve history service in Homebridge accessories, so that it will show in Eve.app (Home.app does not support it). Still work in progress. Use at your own risk, no guarantee is provided.

More details on communication protocol and custom Characteristics here: https://gist.github.com/simont77/3f4d4330fa55b83f8ca96388d9004e7d

Your plugin should expose the corresponding custom Elgato services and characteristics in order for the history to be seen in Eve.app. For a weather example see https://github.com/simont77/homebridge-weather-station-extended, for an energy example see https://github.com/simont77/homebridge-myhome/blob/master/index.js (MHPowerMeter class). Then import module into your plugin module export with:

    var FakeGatoHistoryService = require('./fakegato-history')(homebridge);

Add your service using:

    this.loggingService = new FakeGatoHistoryService(accessoryType, Accessory, length);
       
where

- accessoryType can be "weather" or "energy"
- Accessory should be the accessory using the service, in order to correctly set the service name and pass the log to the parent object. Your Accessory should have a `this.log` variable pointing to the homebridge logger passed to the plugin constructor (add a line `this.log=log;` to your plugin). Debug messages will be shown if homebridge is launched with -D option.
- length is the history length; if no value is given length is set to 4032 samples
        
Add entries to history of accessory emulating Eve Weather using something like this every 10 minutes:

	this.loggingService.addEntry({time: moment().unix(), temp:this.temperature, pressure:this.airPressure, humidity:this.humidity});	

AiPressure is in mbar, Temperature in Celsius, Humidity in %.

Add entries to history of accessory emulating Eve Energy using something like this every 10 minutes:

    this.loggingService.addEntry({time: moment().unix(), power: this.power}); 
    
Power should be the average power in W over 10 minutes period. To have good accuracy, it is strongly advised not to use a single instantaneous measurement, but to average many few seconds measurements over 10 minutes.

For Energy accessories it is also worth to add the custom characteristic E863F112 for resetting the Total Consumption accumulated value (not the history). See the gist above. The value of this characteristic is changed whenever the reset button is tapped on Eve, so it can be used to reset the locally stored value. The meaning of the exact value is still unknown. I left this characteristics out of fakegato-history because it is not part if the common  history service, up to know I found it only on Eve Energy

### TODO

- [x] Support for rolling-over of the history
- [x] Aggregate transmission of several entries into a single Characteristic update in order to speed up transfer when not on local network.
- [ ] Add other accessory types. Help from people with access to real Eve accessory is needed. Dump of custom Characteristics during data transfer is required.
- [ ] Make history persistent 
- [x] Adjustable history length
- [ ] Periodic sending of reference time stamp (seems not really needed if the time of your homebridge machine is correct)

### Known bugs
- ~~There is a delay of one entry between the history and the upload to Eve.app, i.e. entry n will be uploaded only when entry n+1 is added to the history~~

### How to contribute

If you own an Eve accessory and would like to help improving this module, you can follow this procedure to dump the communication:

- Install Xcode on a Mac with High Sierra and register for a free Apple Developer Account
- Download this code https://github.com/simont77/HMCatalog-Swift3/tree/experimental and compile the HMCatalog app. Follow this guide https://stackoverflow.com/questions/30973799/ios-9-new-feature-free-provisioning-run-your-app-on-a-device-just-with-your-ap to compile for your own device and install on it (the app will not work on any other device). The App will run only for few days, since the code signature has a very short expiration date, but you can repeat the procedure if needed. This is called Free Provisioning, you may find many additional guides on the web in case of issues. You will have also to enable Homekit support, let Xcode fix issues when it offers to do it.
- Run the HMCatalog app. You should be able to read raw values of all the characteristics of your accessories.
- Trigger an history transfer of the history within Eve.app
- Open again the HMCatalog app, select your Eve accessory and the Service E863F007-079E-48FF-8F27-9C2605A29F52. If using an iPad you can open HMCatalog and Eve in split view to monitor in real time the communication as it occurs.
- Copy values of all characteristics (especially E863F117-079E-48FF-8F27-9C2605A29F52 and E863F116-079E-48FF-8F27-9C2605A29F52) and leave me a comment with it.
