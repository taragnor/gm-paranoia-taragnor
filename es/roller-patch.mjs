Roll.fromData_oldSecurity = Roll.fromData;

Roll.fromData = function (data) {
	let roll = Roll.fromData_oldSecurity(data);
	if (roll.security) {
		roll.options._securityTS = security.TS;
		roll.options._securityId = security.log_id;
	}
	roll.security = data.security;
	return roll;
}

Roll.prototype.toJSON_oldSecurity = Roll.prototype.toJSON;

Roll.prototype.toJSON = function () {
	let json = this.toJSON_oldSecurity();
	json.security = this.security;
	return json;
}

