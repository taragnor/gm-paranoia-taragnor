import { SecurityLogger } from "./security-logger.mjs";
import { } from "./debug.mjs";



const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";
const PUNISH_MONGREL= "CHEATER_DETECTED";
const logpath = "";

class TaragnorSecurity {

	static async SecurityInit() {
		if (game.user.isGM)
			console.log("*** SECURITY ENABLED ***");
		game.socket.on("module.secure-foundry", this.socketHandler.bind(this));
		this.logger = new SecurityLogger(logpath);
		this.awaitedRolls = [];
		if (this.replaceRollProtoFunctions)
			this.replaceRollProtoFunctions();
		this.startScan = false;
		Hooks.on("renderChatMessage", this.verifyChatRoll.bind(this));
	}

	static rollRequest(dice_expr = "1d6", timestamp, targetGMId) {
		this.socketSend( {
			command: ROLL_REQUEST,
			gm_id: targetGMId,
			rollString: dice_expr,
			timestamp,
			player_id: game.user.id
		});
	}

	static dispatchCheaterMsg(player_id, infraction) {
		this.socketSend( {
			command: PUNISH_MONGREL,
			infraction,
			player_id
		});
	}

	static rollSend(dice, GMtimestamp, player_id, player_timestamp) {
		this.socketSend({
			command:ROLL_MADE,
			target: player_id,
			dice,
			timestamp: GMtimestamp,
			player_id,
			player_timestamp: player_timestamp,
		});
	}

	static async rollRecieve({dice: rollData, player_timestamp, player_id}) {
		try {
			const roll = Roll.fromJSON(rollData);
			const awaited = this.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user.id);
			if (Number.isNaN(roll.total) || roll.total == undefined) {
				throw new Error("NAN ROLL");
			}
			awaited.resolve(roll);
			this.awaitedRolls = this.awaitedRolls.filter (x => x != awaited);
			return roll;
		} catch (e) {
			console.error(e);
			console.log(rollData);
			return rollData;
		}
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
		game.socket.emit('module.secure-foundry', data);
	}

	static async recievedRollRequest({gm_id, rollString, player_id, timestamp}) {
		if (!game.user.isGM || game.user.id != gm_id) {
			console.log("Disregarding recieved roll request");
			console.log(`${gm_id}`);
			return;
		}
		// console.log(`Recieved request to roll ${rollString}`);
		const dice = new Roll(rollString);
		let roll = await dice.evaluate({async:true});
		// this._displayRoll(roll); // NOTE: debug code
		const gm_timestamp = this.logger.getTimeStamp();
		this.rollSend(JSON.stringify(roll), gm_timestamp, player_id, timestamp);
		await this.logger.logRoll(roll, player_id, gm_timestamp);
	}

	static async cheatDetectRecieved({player_id, infraction}) {
		if (game.user.id != player_id)
			return;
		switch (infraction) {
			case "cheater":
				console.log("CHEATING MONGREL DETECTED");
				break;
			case "sus":
				console.log("YOU ARE SUS");
				break;
		}
	}

	static async socketHandler(data) {
		if (!data?.command)
			throw new Error("Malformed Socket Transmission");
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
			this.awaitedRolls.push( {
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
				const roll= await  TaragnorSecurity.secureRoll(this);
				TaragnorSecurity.replaceRoll(this, roll);
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
		if (!this.startScan && timestamp > this.logger.startTime) {
			this.startScan = true; //we've reached the new messages so we can start scanning
		}
		if (chatmessage.user.isGM)
			return true;
		if (!this.startScan)  {
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
			case "sus":
				html.addClass("player-sus");
				$(`<div class="player-sus"> ${chatmessage.user.name} is Sus </div>`).insertBefore(insert_target);
				this.dispatchCheaterMsg(player_id, "sus");
				break;
			case "verified":
				const insert = $(`<div class="roll-verified"> Roll Verified </div>`);
				this.startTextAnimation(insert);
				html.addClass("roll-verified");
				insert.insertBefore(insert_target);
				break;
			case "not found": case "roll_used": case "no-roll":
				html.addClass("cheater-detected");
				$(`<div class="cheater-detected"> Cheater detected </div>`).insertBefore(insert_target);
				this.dispatchCheaterMsg(player_id, "cheater");
				break;
		}
		return true;
	}

	static startTextAnimation (html) {
		//NOTE PROB BEST TO REPLACE THIS WITH CUSTOM GM MESSAGE FOR VERIFICATION TO PREVENT FORGERY
		const sleep = function(time)  {
			return new Promise ( (resolve, reject) => {
				setTimeout(resolve, time);
			});
		}
		const changeText=  async () =>  {
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


}


	Hooks.on("ready", TaragnorSecurity.SecurityInit.bind(TaragnorSecurity));


//DEBUG CODE
	// window.secureRoll = TaragnorSecurity.secureRoll.bind(TaragnorSecurity);
	// window.sec = TaragnorSecurity;
	// window.rollRequest = TaragnorSecurity.rollRequest.bind(TaragnorSecurity);
