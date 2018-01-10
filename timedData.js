'use strict';

module.exports = {
	timedData: timedData
};

function timedData(params) {

		this.subscribedServices = [];
		this.minutes    = params && params.minutes || 10;
		this.initialPush= params && params.initialPush || false;
		this.intervalID = null;
		this.running    = false;
		this.lastValue  = params && params.lastValue || 0;
		this.callback   = (params && typeof(params.callback)=='function')?params.callback.bind(this):undefined;

		this.history	= [];
		
		if(this.initialPush) {
			setImmediate(this.historicalDatas.bind(this));
		}
		this.start();
}
	
	// Subscription management
timedData.prototype.subscribe=function(service,callback) {
		if(typeof(callback) == 'function') {
			callback = callback.bind(this);
		}
		let newService = {
			'service'   : service,
			'callback'  : callback,
			'history'   : []
		};
		console.log('new service subscribed',newService);
		this.subscribedServices.push(newService);
		if(!this.running) this.start();
}
timedData.prototype.getSubscriber=function(service) {
		let findServ = function(element) {
			return element.service === service;
		};
		return this.subscribedServices.find(findServ);
}
timedData.prototype._getSubscriberIndex=function(service) {
		let findServ = function(element) {
			return element.service === service;
		};
		return this.subscribedServices.findIndex(findServ);
}
timedData.prototype.getSubscribers=function() {
		return this.subscribedServices;
}
timedData.prototype.unsubscribe=function(service) {
		console.log('service want to unsubscribe',service);
		let index = this._getSubscriberIndex(service);
		this.subscribedServices.splice(index,1);
		if(this.subscribedServices.length === 0 && this.running) this.stop();
}

	// Timer management
timedData.prototype.start=function() {
		if(this.running) this.stop();
		this.running = true;
		this.intervalID = setInterval(this.historicalDatas.bind(this),this.minutes * 60 * 1000);
		console.log('started the timer',this.intervalID,'every',this.minutes,'min');
}
timedData.prototype.stop=function() {
		console.log('stopping the timer',this.intervalID);
		clearInterval(this.intervalID);
		this.running = false;
		this.intervalID = null;
}
	
	// Data management
timedData.prototype.historicalDatas=function() {
		if(this.subscribedServices.length !== 0) {
			for(let s in this.subscribedServices) {
				if (this.subscribedServices.hasOwnProperty(s)) {
					let service = this.subscribedServices[s];
					console.log('calling back for',this.IntervalID);
					if(typeof(service.callback) == 'function') service.callback(service.history);
				}
			}	
		}
		else {
			console.log('calling back for',this.IntervalID);
			if(typeof(this.callback) == 'function') this.callback(this.lastValue);
		}
}
timedData.prototype.addData=function(data,service) {
		var history;
		if(this.subscribedServices.length !== 0 && service) {
			history = this.getSubscriber(service).history;
		}
		else history = this.history;
		
		console.log('adding data to ',this.IntervalID,' from addData',data);
		history.push(data);
		if(this.running === false) this.start()
}
timedData.prototype.emptyData=function(service) {
		var history;
		if(this.subscribedServices.length !== 0 && service) {
			history = this.getSubscriber(service).history;
		}
		else history = this.history;
		console.log('empty data of',this.IntervalID);
		history=[];
}

	
