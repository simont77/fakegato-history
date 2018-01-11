'use strict';

class FakeGatoTimer {
	constructor(params) {
		if(!params) params={};
		this.subscribedServices = [];
		this.minutes    = params.minutes || 10;
		this.initialPush= params.initialPush || false;
		this.intervalID = null;
		this.running    = false;
		this.lastEntry  = params.lastEntry || {};
		this.callback   = (typeof(params.callback)=='function')?params.callback.bind(this):undefined;
		this.log		= params.log || {};
		if(!params.log) {
			this.log.debug = console.error;
		}

		this.history	= [];
		this.previousHistory=[]; // be ready if need to repeat every this.minutes if no data
		
		if(this.initialPush) {
			setTimeout(this.executeCallback.bind(this),0,true);
		}
		this.start();
	}
	
	// Subscription management
	subscribe(service,callback) {
		let newService = {
			'service'   : service,
			'callback'  : callback,
			'history'   : [],
			'previousHistory':[] // be ready if need to repeat every this.minutes if no data
		};

		this.subscribedServices.push(newService);
		if(!this.running) this.start();
	}
	getSubscriber(service) {
		let findServ = function(element) {
			return element.service === service;
		};
		return this.subscribedServices.find(findServ);
	}
	_getSubscriberIndex(service) {
		let findServ = function(element) {
			return element.service === service;
		};
		return this.subscribedServices.findIndex(findServ);
	}
	getSubscribers() {
		return this.subscribedServices;
	}
	unsubscribe(service) {
		let index = this._getSubscriberIndex(service);
		this.subscribedServices.splice(index,1);
		if(this.subscribedServices.length === 0 && this.running) this.stop();
	}

	// Timer management
	start() {
		if(this.running) this.stop();
		this.running = true;
		this.intervalID = setInterval(this.executeCallback.bind(this),this.minutes * 60 * 1000,false);
	}
	stop() {
		clearInterval(this.intervalID);
		this.running = false;
		this.intervalID = null;
	}
	
	// Data management
	executeCallback(initial) {
		if(this.subscribedServices.length !== 0) {
			for(let s in this.subscribedServices) {
				if (this.subscribedServices.hasOwnProperty(s)) {
					let service = this.subscribedServices[s];
					if(typeof(service.callback) == 'function' && service.history.length) 
						service.callback(service.history,this);
				}
			}	
		}
		else {
			if(typeof(this.callback) == 'function') this.callback(this.lastEntry,initial);
		}
	}
	addData(data,service) {
		var history;
		if(this.subscribedServices.length !== 0 && service) {
			history = this.getSubscriber(service).history;
		}
		else history = this.history;
		
		history.push(data);
		if(this.running === false) this.start()
	}
	emptyData(service) {
		var source;
		if(this.subscribedServices.length !== 0 && service) {
			source = this.getSubscriber(service);
		}
		else source = this;
		
		source.previousHistory=source.history; // be ready if need to repeat every this.minutes if no data
		source.history=[];
	}

}

function isEmpty(obj) {
   for (var x in obj) { if (obj.hasOwnProperty(x))  return false; }
   return true;
}

module.exports = {
	FakeGatoTimer: FakeGatoTimer
};
