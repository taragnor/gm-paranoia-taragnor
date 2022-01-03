export class SecurityLogger {
	constructor (logPath) {
		this.startTime = Date.now();
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
			used: null
		};
		this.logs.push(logObj );
		console.log( "Logged", logObj);
		if (!this.logFileEnabled) return;
		//TODO: actually write to file

	}

	verifyRoll(roll, timestamp, player_id, chatlog_id) {
		const log =  this.logs.find(x=> x.player_id == player_id
			&& timestamp - x.timestamp < 10000
			&& SecurityLogger.rollsIdentical(x.roll, roll)
		);
		if (!log) {
			console.warn("Roll not found in database");
			return "not found";
		}
		if (log.used && chatlog_id != log.used) {
			return "already_done";
		}
		if (log.used && chatlog_id != log.used) {
			console.warn("Roll was already used");
			return "roll_used";
		}
		log.used = chatlog_id;
		return "verified";
	}

	static rollsIdentical(rollA, rollB) {
		if (rollA.total != rollB.total)
			return false;
		return rollA.terms.every( (term, i) => {
			return term.results.every( (result, j) => {
				return result.result == rollB.terms[i].results[j].result;
			})
		});
	}

	getTimeStamp() {
		return Date.now();
	}

} //end of class



