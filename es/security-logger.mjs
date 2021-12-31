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

	async logRoll(roll, player_id, gm_timestamp) {
		const logObj = {
			roll,
			player_id,
			timestamp:gm_timestamp
		};
		this.logs.push(logObj );
		console.log( "Logged", logObj);
		if (!this.logFileEnabled) return;
		//TODO: actually write to file

	}

	getTimeStamp() {
		return Date.now();
	}

} //end of class



