export class SecurityLogger {
	constructor (logPath) {
		this.logs = [];
		if (!logPath) {
			this.logFileEnabled = false;
			return;
		}
		this.logPath = logPath;
		this.logFileEnabled = true;
		this.loadFile(logPath)
		//TODO: Setup log file logic
	}

	async loadFile(logPath) {

	}

	async logRoll(roll, player_id, gm_timestamp) {
		const logObj = {
			roll,
			player_id,
			timestamp:gm_timestamp,
			used: false
		};
		this.logs.push(logObj );
		console.log( "Logged", logObj);
		if (!this.logFileEnabled) return;
		//TODO: actually write to file

	}

	verifyRoll(roll, timestamp, player_id) {
		const log =  this.logs.find(x=> x.player_id == player_id
			&& timestamp - x.timestamp < 10000
			&& x.roll.total == roll.total
		);
		if (!log) {
			console.warn("Roll not found in database");
			return false;
	}
		if (log.used) {
			console.warn("Roll was already used");
			return false;
		}
		log.used = true;
		return true;
	}


	getTimeStamp() {
		return Date.now();
	}

} //end of class



