'use strict';

module.exports = function() {

	class timedData {
		constructor(params) {
			this.subscribedServices = [];
			this.minutes    = params.minutes || 10;
			this.initialPush= params.initialPush || false;
			this.intervalID = null;
			this.running    = false;
			this.lastValue  = params.lastValue;
			this.callback   = (typeof(params.callback)=='function')?params.callback.bind(this):undefined;

			this.history	= [];
			
			if(this.initialPush) {
				setImmediate(this.historicalDatas.bind(this));
			}
			this.start();
		}
		
		// Subscription management
		subscribe(service,callback) {
            if(typeof(callback) == 'function') {
                callback = callback.bind(this);
            }
            
			this.subscribedServices.push({
				'service'   : service,
				'callback'  : callback,
				'history'   : []
			});
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
			this.intervalID = setInterval(this.historicalDatas.bind(this),this.minutes * 60 * 1000);
		}
		stop() {
			clearInterval(this.intervalID);
			this.running = false;
			this.intervalID = null;
		}
		
		// Data management
		historicalDatas() {
            if(this.subscribedServices.length !== 0) {
                for(let s in this.subscribedServices) {
                    if (this.subscribedServices.hasOwnProperty(s)) {
                        let service = this.subscribedServices[s];
                        if(typeof(service.callback) == 'function') service.callback(service.history);
                    }
                }	
            }
			else {
                this.callback(this.lastValue);
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
            var history;
			if(this.subscribedServices.length !== 0 && service) {
				history = this.getSubscriber(service).history;
			}
			else history = this.history;
			
			history=[];
		}
	}
	
}
