# fakegato-history
Module to emulate Elgato Eve history in homebridge accessories.
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