module.exports = {
	//секретный ключ шифрования
	'secret': 'a97e20fe5ff11cbc64f7a90400af71d9254101cb19a4652e2c1228dd226d9b0008d89e40d5dcabbea354698a0a7a2e24ff65ef8032034cf3c4f0cf4716e82712',
	
	//пользователь сап
	'sapUser': 'skud_uem',
	//пароль пользователя сап
	'sapPassword': 'sRec137K',
	//сервер сап
	'url': 'https://sap-prx.ugmk.com:443/ummc/permit',
	
	//сервер  АД
	'adServer': 'ldap://elem-dc0.elem.ru',
	//домен   cn=Domain User,cn=СТОРОННИЕ ОРГАНИЗАЦИИ,cn=ООО ЧОП Объединение Форпост-УЭМ,
	'adBaseDN': 'dc=elem,dc=ru',
	//пользователь АД, имеющий доступ к АД. требуется для простого получения списка пользоватлей АД 
	'adUser': 'sp_service2@elem.ru',
	//пароль пользователя АД
	'adPassword': 's091215',
	
	//порты сервера ноды
	'portHttps': '8081',
	'portHttp': '8080'
};