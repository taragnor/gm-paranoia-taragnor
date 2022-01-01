import { SecurityLogger } from "./security-logger.mjs";



const ROLL_MADE = "ROLL_MADE";
const ROLL_REQUEST = "ROLL_REQUEST";
const logpath = "";

class TaragnorSecurity {


	static async SecurityInit() {
		console.log("*** SECURITY ENABLED ***");
		game.socket.on("module.secure-foundry", this.socketHandler.bind(this));
		this.logger = new SecurityLogger(logpath);
		this.awaitedRolls = [];
		if (this.replaceRollProtoFunctions)
			this.replaceRollProtoFunctions();
		Hooks.on("renderChatMessage", this.verifyChatRoll.bind(this));
	}

	static rollRequest(dice_expr = "1d6", timestamp, targetGMId) {
		// console.log("Sending Roll request");
		this.socketSend( {
			command: ROLL_REQUEST,
			gm_id: targetGMId, //shoudl be an id
			rollString: dice_expr,
			timestamp,
			player_id: game.user.id
		});
	}

	static rollSend(dice, GMtimestamp, player_id, player_timestamp) {
		this.socketSend({
			command:ROLL_MADE,
			target: player_id, // should be player Id
			dice,
			timestamp: GMtimestamp,
			player_id,
			player_timestamp: player_timestamp,
		});
	}

	static async displayRoll(roll) {
			console.log(`original terms: ${roll.terms.map( x=> x.results.map(y=> y.result))}`);
			console.log(`original total: ${roll.total}`);
	}

	static async rollRecieve({dice: rollData, player_timestamp, player_id}) {
		try {
			const roll = Roll.fromJSON(rollData);
			const awaited = this.awaitedRolls.find( x=> x.timestamp == player_timestamp && player_id == game.user.id);
			if (!roll.total || Number.isNaN(roll.total)) {
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
		await dice._oldeval({async:true});
		// this.displayRoll(dice);
		const gm_timestamp = this.logger.getTimeStamp();
		this.rollSend(JSON.stringify(dice), gm_timestamp, player_id, timestamp);
		await this.logger.logRoll(dice, player_id, gm_timestamp);
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
		Roll.prototype._oldeval = Roll.prototype.evaluate;

		Roll.prototype.evaluate = async function (options ={}) {
			if ( this._evaluated ) {
				throw new Error(`The ${this.constructor.name} has already been evaluated and is now immutable`);
			}
			if (game.user.isGM) {
				console.warn("Running GM Roll");
				this._oldeval(options);
				return this;
			} else {
				console.warn("Running Secure Client Roll");
				const roll= await  TaragnorSecurity.secureRoll(this);
				// console.log(roll);
				TaragnorSecurity.replaceRoll(this, roll);
				return this;
			}
		}
	}

	static verifyChatRoll(chatmessage,b,c,d) {
		if (!game.user.isGM) return;
		if (chatmessage.user.isGM) //this does not work
			return true;
		console.log("Analyzing Message...");
		// console.log(chatmessage);
		const timestamp = chatmessage.data.timestamp;
		const player_id = chatmessage.user.id;
		if (chatmessage.roll) {
			const verified = this.logger.verifyRoll(chatmessage.roll, timestamp, player_id);
		   if (verified)
				console.log("Message is okay");
			else
				console.log(`${chatmessage.user.name} is a dirty cheater: Chat Id:${chatmessage.id}`);
		}
	}

}

function socketTest() {
	socketSend({"test": "Sending shit"});
}


Hooks.on("ready", TaragnorSecurity.SecurityInit.bind(TaragnorSecurity));


window.secureRoll = TaragnorSecurity.secureRoll.bind(TaragnorSecurity);
window.sec = TaragnorSecurity;

window.rollRequest = TaragnorSecurity.rollRequest.bind(TaragnorSecurity);
