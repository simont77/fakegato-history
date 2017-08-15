# fakegato-history
Module to emulate Elgato Eve history service in Homebridge accessories. Still work in progress. Use at your own risk, no guarantee is provided.

More details on communication protocol and custom Characteristics here: https://gist.github.com/simont77/3f4d4330fa55b83f8ca96388d9004e7d

Import module into your plugin module export with:

    var FakeGatoHistoryService = require('./fakegato-history')(homebridge);

Add your service using:

    this.loggingService = new FakeGatoHistoryService(accessoryType);
       
where accessoryType can be "weather" or "energy".
        
        
Add entries to history of accessory emulating Eve Weather using something like this every 10 minutes:

	this.loggingService.addEntry({time: moment().unix(), temp:this.temperature, pressure:this.airPressure, humidity:this.humidity});
	

AiPressure is in mbar, Temperature in Celsius, Humidity in %.

Add entries to history of accessory emulating Eve Energy using something like this every 10 minutes:

    this.loggingService.addEntry({time: moment().unix(), power: this.power}); 
    
Power should be the average power in W over 10 minutes period.

History length is set to 100 entries for testing purposes, but can be increased modifying the constructor.

### TODO

* Support for rolling-over of the history 
* Add other accessory types
* Make history persistent 
* Adjustable history length
* Periodic sending of reference time stamp

### Known issues
* When using multiple iOS clients there may be some inconsistencies in time stamps if few entries are acquired by Eve.app and then Homebridge is restarted. Due to the way the reference time stamp is delivered at present (only at startup or when Eve.app asks entry 0x00): must be improved.