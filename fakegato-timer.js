/*jshint esversion: 6,node: true,-W041: false */
'use strict';

const DEBUG = true;

class FakeGatoTimer {
	constructor(params) {
		if (!params)
			params = {};
		this.subscribedServices = [];
		this.minutes = params.minutes || 10;

		this.intervalID = null;
		this.running = false;
		this.log = params.log || {};
		if (!params.log || !params.log.debug) {
			if(DEBUG) this.log.debug = console.log;
			else this.log.debug = function(){};
		}
	}

	// Subscription management
	subscribe(service, callback) {
		this.log.debug("****Subscription :",service.accessoryName);
		let newService = {
			'service': service,
			'callback': callback,
			'backLog': [],
			'previousBackLog': []
		};

		this.subscribedServices.push(newService);
	}
	getSubscriber(service) {
		let findServ = function (element) {
			return element.service === service;
		};
		return this.subscribedServices.find(findServ);
	}
	_getSubscriberIndex(service) {
		let findServ = function (element) {
			return element.service === service;
		};
		return this.subscribedServices.findIndex(findServ);
	}
	getSubscribers() {
		return this.subscribedServices;
	}
	unsubscribe(service) {
		let index = this._getSubscriberIndex(service);
		this.subscribedServices.splice(index, 1);
		if (this.subscribedServices.length === 0 && this.running)
			this.stop();
	}

	// Timer management
	start() {
		this.log.debug("****Start Global Timer - ",this.minutes,"min****");
		if (this.running)
			this.stop();
		this.running = true;
		this.intervalID = setInterval(this.executeCallbacks.bind(this), this.minutes * 60 * 1000);
	}
	stop() {
		this.log.debug("****Stop Global Timer****");
		clearInterval(this.intervalID);
		this.running = false;
		this.intervalID = null;
	}

	// Data management
	executeCallbacks() {
		this.log.debug("****executeCallbacks****");
		if (this.subscribedServices.length !== 0) {
			for (let s in this.subscribedServices) {
				if (this.subscribedServices.hasOwnProperty(s)) {
					
					let service = this.subscribedServices[s];
					if (typeof(service.callback) == 'function' && service.backLog.length)
						service.callback(service.backLog, this, false);
				}
			}
		}
	}
	executeImmediateCallback(service) {
		this.log.debug("****executeImmediateCallback****");

		if (typeof(service.callback) == 'function' && service.backLog.length)
			service.callback(service.backLog, this, true);
	}	
	addData(params) {
		let data = params.entry;
		let service = params.service;
		let immediateCallback = params.immediateCallback || false;
		
		this.log.debug("****addData",data,immediateCallback);
		
		if(immediateCallback) // door or motion -> replace
			this.getSubscriber(service).backLog[0] = data;
		else
			this.getSubscriber(service).backLog.push(data);
		
		if (immediateCallback) {
			//setTimeout(this.executeImmediateCallback.bind(this), 0,service);
			this.executeImmediateCallback(this.getSubscriber(service));
		}
		
		if (this.running === false)
			this.start();
	}
	emptyData(service) {
		this.log.debug("****emptyData****");
		let source = this.getSubscriber(service);

		source.previousBackLog = source.backLog;
		source.backLog = [];
	}

}

module.exports = {
	FakeGatoTimer: FakeGatoTimer
};
