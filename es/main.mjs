import { SecurityLogger } from "./security-logger.mjs";
import { } from "./debug.mjs";



const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";
const PUNISH_MONGREL= "CHEATER_DETECTED";
const DIAGNOSTIC= "DIAGNOSTIC";
const logpath = "";
const REPORT_IN = "PLAYER_REPORT_IN";
const REQUEST_REPORT = "GM_REQUEST_REPORT";
const REPORT_ACK = "GM_ACKNOWLEDGE_REPORT";

class TaragnorSecurity {

	static async SecurityInit() {
		if (game.user.isGM)
			console.log("*** SECURITY ENABLED ***");
		game.socket.on("module.gm-paranoia-taragnor", this.socketHandler.bind(this));
		this.logger = new SecurityLogger(logpath);
		if (this.replaceRollProtoFunctions)
			this.replaceRollProtoFunctions();
			this.initialReportIn();
		Hooks.on("renderChatMessage", this.verifyChatRoll.bind(this));
		Object.freeze(this);
	}

	static rollRequest(dice_expr = "1d6", timestamp, targetGMId) {
		this.socketSend( {
			command: ROLL_REQUEST,
			target: targetGMId,
			gm_id: targetGMId,
			rollString: dice_expr,
			timestamp,
			player_id: game.user.id
		});
	}

	static dispatchCheaterMsg(player_id, infraction, rollId) {
		this.socketSend( {
			command: PUNISH_MONGREL,
			target: player_id,
			infraction,
			player_id,
			rollId
		});
	}

	static rollSend(dice, GMtimestamp, player_id, player_timestamp, log_id) {
		this.socketSend({
			command:ROLL_MADE,
			target: player_id,
			dice,
			timestamp: GMtimestamp,
			player_id,
			player_timestamp: player_timestamp,
			log_id
		});
	}

	static async rollRecieve({dice: rollData, player_timestamp, player_id, timestamp: gm_timestamp, log_id}) {
		try {
			const roll = Roll.fromJSON(rollData);
			const awaited = this.logger.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user.id);
			if (Number.isNaN(roll.total) || roll.total == undefined) {
				throw new Error("NAN ROLL");
			}
			awaited.resolve({roll, gm_timestamp, log_id});
			this.logger.awaitedRolls = this.logger.awaitedRolls.filter (x => x != awaited);
			return {roll, gm_timestamp, log_id};
		} catch (e) {
			console.error(e);
			console.log(rollData);
			return rollData;
		}
	}

	static async sendDiagnostic({gm_id, rollId}) {
		let diagnostics = {};
		for ( const x of Object.getOwnPropertyNames(Roll.prototype)) {
			try {
			if (Roll.prototype[x] == undefined)
				continue;
			} catch(e) {continue;}
			if (typeof Roll?.prototype[x] == 'function') {
				diagnostics[x] = Roll.prototype[x].toString();
			}
		}
		this.socketSend({
			target: gm_id,
			command:DIAGNOSTIC,
			diagnostics,
			rollId
		});

	}

	static replaceRoll(roll, rollData) {
		for (let i = 0; i < rollData.terms.length; i++)
			if (rollData.terms[i].results) //check for 0 dice rolls
				for (let j = 0; j< rollData.terms[i].results.length; j++)
					if (rollData.terms[i].results) //check for 0 dice rolls
						roll.terms[i].results[j] = rollData.terms[i].results[j];
		roll._total = rollData.total;
		roll._evaluated = true;
		return roll;
	}

	static socketSend(data) {
		game.socket.emit('module.gm-paranoia-taragnor', data);
	}

	static async recievedRollRequest({gm_id, rollString, player_id, timestamp}) {
		if (!game.user.isGM || game.user.id != gm_id) {
			console.log("Disregarding recieved roll request");
			console.log(`${gm_id}`);
			return;
		}
		// console.log(`Recieved request to roll ${rollString}`);
		const dice = new Roll(rollString);
		let roll;
		try {
			roll = await dice.evaluate({async:true});
		} catch (e) {
			Debug(dice);
			throw e;
		}
		const log_id = this.logger.getNextId();
		// this._displayRoll(roll); // NOTE: debug code
		const gm_timestamp = this.logger.getTimeStamp();
		dice.options._securityTS = gm_timestamp;
		dice.options._securityId = log_id;
		this.rollSend(JSON.stringify(roll), gm_timestamp, player_id, timestamp, log_id);
		if (!gm_timestamp)
			console.warn("No Timestamp provided with roll");
		await this.logger.logRoll(roll, player_id, gm_timestamp);
	}

	static async cheatDetectRecieved({player_id, infraction, rollId}) {
		if (game.user.id != player_id)
			return;
		const GMId = game.users.find( x=> x.isGM).id;
		switch (infraction) {
			case "cheater":
				// console.log("CHEATING MONGREL DETECTED");
				await this.sendDiagnostic({gm_id: GMId});
				break;
			case "sus":
				// console.log("YOU ARE SUS");
				await this.sendDiagnostic({gm_id: GMId});
				break;
		}
	}

	static async recieveCheaterDiagnostic({diagnostics, rollId}) {
		console.log("*** Diagnostic Recieved from suspected Cheater ***");
		let violations = new Array();
		for (const x in diagnostics) {
			if (diagnostics[x] != Roll.prototype[x]?.toString()) {
				console.warn(`Tampered function found in class Roll, function "${x}":\n ${diagnostics[x]}`);
				violations.push(`${x}:${diagnostics[x]}`);
			}
		}
		if (violations.length > 0) {
			const logs = game.messages.filter(x=> x?.roll?.options?._securityId == rollId);
			for (let log of logs) {
				await this.updateLogFullCheat(log);
			}
		} else
				console.log("No signs of tampering with the Roll functions");
		return violations;
	}

	static async updateLogFullCheat(log) {
		//TODO Finish
	}

	static async socketHandler(data) {
		if (!data?.command)
			throw new Error("Malformed Socket Transmission");
		if (data.target != game.user.id)
			return;
		switch (data.command) {
			case ROLL_REQUEST:
				await this.recievedRollRequest(data);
				return true;
			case ROLL_MADE:
				await this.rollRecieve(data);
				return true;
			case PUNISH_MONGREL:
				await this.cheatDetectRecieved(data);
				return true;
			case DIAGNOSTIC:
				await this.recieveCheaterDiagnostic(data);
				return true;
			case REPORT_IN:
				await this.reportInRecieved(data);
				return true;
			case REQUEST_REPORT:
				await this.reportInRequested(data);
				return true;
			case REPORT_ACK:
				await this.onAcknowledgePlayerReportIn(data);
				return true;
			default:
				console.warn(`Unknown socket command: ${command}`);
				console.log(data);
				return true;
		}
	}


	static async secureRoll (unevaluatedRoll) {
		if (typeof unevaluatedRoll == "string") {
			//convert string roll to real roll
			unevaluatedRoll = new Roll(unevaluatedRoll);
			// console.log("Converted String roll to real roll");
		}
		if (game.user.isGM)  {
			return await unevaluatedRoll.evaluate({async: true});
		}
		return await new Promise(( conf, rej) => {
			const timestamp = this.logger.getTimeStamp();
			this.logger.awaitedRolls.push( {
				playerId: game.user.id,
				expr: unevaluatedRoll.formula,
				timestamp,
				resolve: conf,
				reject: rej,
			});
			const GMId = game.users.find( x=> x.isGM).id;
			if (!GMId) rej(new Error("No GM in game"));
			this.rollRequest(unevaluatedRoll.formula, timestamp, GMId);
		});
	}

	static replaceRollProtoFunctions() {
		//Replaces the original evaluate function with new Roller
		Roll.prototype._oldeval = Roll.prototype._evaluate;

		Roll.prototype._evaluate = async function (options ={}) {
			if (game.user.isGM) {
				return this._oldeval(options);
			} else {
				// console.warn("Running Secure Client Roll");
				const {roll, gm_timestamp, log_id} = await TaragnorSecurity.secureRoll(this);
				TaragnorSecurity.replaceRoll(this, roll);
				this.options._securityTS = gm_timestamp;
				this.options._securityId = log_id;
				return this;
			}
		}

		Roll.prototype.getResultsArray = function() {
			return this.terms
				.filter( term => !term.isDeterministic)
				.map ( term => {
				return term.results.map( result=> result.result);
			}).flat();
		}

	}

	static verifyChatRoll(chatmessage, html,c,d) {
		if (!game.user.isGM) return;
		const timestamp = chatmessage.data.timestamp;
		if (!this.logger.startScan && timestamp > this.logger.startTime) {
			this.logger.startScan = true; //we've reached the new messages so we can start scanning
		}
		if (chatmessage.user.isGM)
			return true;
		if (!this.logger.startScan)  {
			return true;
		}
		const player_id = chatmessage.user.id;
		if (!chatmessage.roll) {
			if (!html.hasClass("roll-verified")) //tries to resist forged roll-verified header on a non-roll message
				return true;
		}
		const logger_response = this.logger.verifyRoll(chatmessage.roll, timestamp, player_id, chatmessage.id);
		const verified = (chatmessage.roll) ? logger_response : "no-roll";
		const insert_target = html.find(".message-header");
		switch(verified) {
			case "already_done":
				console.log("Already Done");
				break;
			case "unused_rolls":
				this.susMessage(html, "Has Unused rolls", chatmessage);
				break;
			case "no-report":
				this.susMessage(html, "Never reported in", chatmessage);
				break;
			case "stale":
				this.susMessage(html, "Roll used is stale", chatmessage);
				break;
			case "verified":
				this.verifyMessage(html, "verified", chatmessage);
				break;
			case "roll_modified":
				this.cheaterMessage(html, "Roll Modification detected", chatmessage);
				break;
			case "not_found":
				this.susMessage(html, "Roll not found", chatmessage);
				break;
			case "roll_used_multiple_times":
				this.susMessage(html, "Roll used twice", chatmessage);
				break;
			case "no-roll": //currently not used
				this.cheaterMessage(html, "No Roll", chatmessage);
				break;
			default:
				this.susMessage(html, `unusual error ${verified}`, chatmessage);
				break;
		}
		return true;
	}

	static susMessage(html, reason, chatmessage) {
		const insert_target = html.find(".message-header");
		html.addClass("player-sus");
		$(`<div class="player-sus security-msg"> ${chatmessage.user.name} is Sus (${reason}) </div>`).insertBefore(insert_target);
		this.dispatchCheaterMsg(chatmessage.user.id, "sus");
	}

	static cheaterMessage(html, reason, chatmessage) {
		const insert_target = html.find(".message-header");
		html.addClass("cheater-detected");
		$(`<div class="cheater-detected security-msg"> ${chatmessage.user.name} is a cheater (${reason}) </div>`).insertBefore(insert_target);
		this.dispatchCheaterMsg(chatmessage.user.id, "cheater", chatmessage.roll.options._securityId);
	}

	static verifyMessage(html, _reason, _chatmessage) {
		const insert_target = html.find(".message-header");
		const insert = $(`<div class="roll-verified security-msg"> Roll Verified </div>`);
		this.startTextAnimation(insert);
		html.addClass("roll-verified");
		insert.insertBefore(insert_target);
	}

	static startTextAnimation (html) {
		//NOTE PROB BEST TO REPLACE THIS WITH CUSTOM GM MESSAGE FOR VERIFICATION TO PREVENT FORGERY
		const sleep = function(time)  {
			return new Promise ( (resolve, reject) => {
				setTimeout(resolve, time);
			});
		}
		const changeText = async () =>  {
			await sleep(5000 + Math.random() * 10000);
			const original = html.text();
			html.text("No Cheating");
			await sleep(5000 + Math.random() * 10000);
			html.text(original);
			setTimeout(changeText, 10000 + Math.random() * 20000);
		}
		setTimeout(changeText, 1000);
	}

	static async _displayRoll(roll) {
		//DEBUG FUNCTION
		console.log(`original terms: ${roll.terms.map( x=> x.results.map(y=> y.result))}`);
		console.log(`original total: ${roll.total}`);
	}


	static async initialReportIn() {
		const gm_id = game.users.find( x=> x.isGM).id;
		if (game.user.isGM)
			this.sendReportInRequests();
		else {
			if (gm_id)
				this.reportIn(gm_id);
		}
	}

	static async reportIn(gm_id) {
		if (!this.logger.reported) {
			this.socketSend( {
				command: REPORT_IN,
				target: gm_id,
				player_id: game.user.id
			});
			setTimeout( this.reportIn.bind(this, gm_id), 5000);
		}
	}

	static async sendReportInRequest(player_id) {
		this.socketSend( {
			command: REQUEST_REPORT,
			target: player_id,
			gm_id: game.user.id
		});
	}

	static async sendReportAcknowledge(player_id) {
		this.socketSend( {
			command: REPORT_ACK,
			target: player_id,
			gm_id: game.user.id
		});
	}

	static async sendReportInRequests() {
		for (const user of game.users.filter( x=> !x.isGM))
			await this.sendReportInRequest(user.id);
	}

	static async reportInRecieved({player_id}) {
		console.debug(`${game.users.get(player_id).name} has reported in`);
		this.logger.playerSignIn(player_id);
		await this.sendReportAcknowledge(player_id);
	}

	static async reportInRequested({gm_id}) {
		this.logger.reported = false;
		await this.reportIn(gm_id);
	}

	static async onAcknowledgePlayerReportIn(_data) {
		this.logger.reported = true;
	}
}

Hooks.on("getSceneControlButtons", function(controls) {
	let tileControls = controls.find(x => x.name === "token");
	if (game.user.isGM) {
		tileControls.tools.push({
			icon: "fas fa-dice",
			name: "DiceLog",
			title: "DiceLog",
			button: true,
			onClick: () => TaragnorSecurity.logger.viewLog()
		});
	}
});


	Hooks.on("ready", TaragnorSecurity.SecurityInit.bind(TaragnorSecurity));


//DEBUG CODE
	// window.secureRoll = TaragnorSecurity.secureRoll.bind(TaragnorSecurity);
	// window.sec = TaragnorSecurity;
	// window.rollRequest = TaragnorSecurity.rollRequest.bind(TaragnorSecurity);


