export class SecurityLogger {
	constructor (logPath) {
		this.logs = [];
		if (!logPath) {
			this.logFileEnabled = false;
			return;
		}
		this.logFileEnabled = true;
		//TODO: Setup log file logic
	}

	logRoll(roll) {


	}

	getTimeStamp() {
		return Date.now();
	}

} //end of class



