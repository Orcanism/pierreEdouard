require('dotenv').config();

const Discord = require('discord.js');
const fs = require('fs');
const https = require('https');
const jsdom = require('jsdom');
const client = new Discord.Client();
const usersMap = new Map();
client.login(process.env.TOKEN);

// Définition du fichier de config
const config = require('./configFiles/config.json');
const prefix = config.prefix;
const buildCommandItemVersion = config.buildCommandItemVersion;

// Définition de toute les constantes contenant les JSON
const insultList = require('./insultList.json');
const pick4meList = require('./pick4meList.json');
const championBuildList = require('./championBuildList.json');
const buildItemsCorres = require('./buildItemsCorres.json');
const liveGameList = require('./liveGameList.json');

// Fonction getRandomInt, permet de récupérer un nombre entier aléatoire strictement inférieur a max
function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
}

// Fonction normalizeChampionBuildList, permet de normaliser le nom des champions pour la commande build
function normalizeChampionBuildList(str) {
	let champion = str.toLowerCase()
		.replace(/\./g, "")
		.replace(/\'/g, "")
		return champion;
}

// Fonction getOpggItemId, permet de récupérer l'id d'un item dans le lien de l'image correspondante sur op.gg
function getOpggItemId(linkSrc) {
	
}

// Liste lolRole, liste les roles jouable sur League of Legends
const lolRoleList = ['top','jungle','mid','adc','support'];

// Liste lolServerList, liste des serveurs de League of Legends 
const lolServerList = ['na1', 'euw1', 'eun1', 'kr', 'br1', 'jp1', 'ru', 'oc1', 'tr1', 'la1', 'la2'];

// const wrongChannel, est le messages envoyé lorsque le channel dans le quel la commande est envoyé n'est pas autorisé
const wrongChannel = 'Vous ne pouvez pas utiliser cette commande ici';


// Actions s'éxécutant au démarage du bot
client.on('ready', () => {
	console.log('Pierre-Edouard is ready !');
});

// Actions s'éxécutant lorsqu'un membre rejoint le serveur
client.on('guildMemberAdd', member => {
	// Ajoute le role Viewer à tous les nouveaux arrivants
	member.roles.add(process.env.viewerRoleId);

	// Met à jour le compteur de membre
	let memberCountChannel = client.channels.cache.get(process.env.memberCountChannelId);
	config['memberCount'] = member.guild.memberCount;
	let memberCountPush = JSON.stringify(config, null, 4);
	fs.writeFile("./configFiles/config.json", memberCountPush, () => console.error);
	memberCountChannel.setName('Membres : ' + config['memberCount']);
});

// Actions s'éxécutant lorsqu'un membre quitte le serveur
client.on('guildMemberRemove', member => {
	// Met à jour le compteur de membre
	let memberCountChannel = client.channels.cache.get(process.env.memberCountChannelId);
	config['memberCount'] = member.guild.memberCount;
	let memberCountPush = JSON.stringify(config, null, 4);
	fs.writeFile("./configFiles/config.json", memberCountPush, () => console.error);
	memberCountChannel.setName('Membres : ' + config['memberCount']);
});

// Actions s'éxécutant lorsqu'un message est envoyé
client.on('message', msg => {
	if (msg.author.bot) return; // Ne prends pas en compte les messages venant de bot

	// Anti Spam
	if (usersMap.has(msg.author.id)) {
		const userData = usersMap.get(msg.author.id);
		let msgCount = userData.msgCount;
		msgCount ++;
		if (parseInt(msgCount) === 4) {
			const muteTextRole = process.env.muteTextRoleId;
			msg.member.roles.add(muteTextRole);
			msg.channel.send('GG <@!' + msg.author.id + '> t\'as été mute !')
		}
		else {
			userData.msgCount = msgCount;
			usersMap.set(msg.author.id, userData);
		}
	}
	else {
		usersMap.set(msg.author.id, {
			msgCount: 1,
			timer: null
		});
		setTimeout(() => {
			usersMap.delete(msg.author.id);
		}, 1000)
	}

	// Vérifie que le message débute avec le préfixe
	if (msg.channel.type !== "dm" && !msg.author.bot) {
		checkPrefix = msg.content.startsWith(prefix);
		let args = null;

		// Separe le préfixe, la commande et les arguments dans des variables différentes
		if (checkPrefix) {
			args = msg.content.slice(prefix.length).split(' ');

			cmd = args.shift().toLowerCase();

			// Commande test, permet de tester les choses qui ont besoin d'être testées
			if (cmd === 'test') {
				embed = buildEmbed['embed'];
				embed['url'] = embed['url'].replace('@uggCompleteLink', 'https://u.gg');
				msg.channel.send({embed});
			}

			// Commande ping, envoi le ping du bot en milliseconde
			else if (cmd === 'ping') {
				msg.channel.send('J\'ai ' + client.ws.ping + ' ms de latence');
				console.log(client.ws.ping + ' ms');
			}

			// Commande apod, vérifie d'être dans le salon astrophoto puis envoi le lien apod du jour
			else if (cmd === 'apod') {
				if (msg.channel.id === process.env.apodChannelId || msg.channel.id === process.env.twitchBotChannelId) {
					let dateNow = new Date();
					let apodHours = dateNow.getUTCHours();
					let apodYear = dateNow.getUTCFullYear() % 100;
					let apodMonth = dateNow.getUTCMonth() + 1;
					if (apodMonth < 10) {
						apodMonth = '0' + apodMonth;
					}
					let apodDate = dateNow.getUTCDate();
					if (apodHours <= 5) {
						apodDate ++;
					}
					if (apodDate < 10) {
						apodDate = '0' + apodDate;
					}
					let link = {host: 'apod.nasa.gov', path: '/apod/ap' + apodYear + apodMonth + apodDate + '.html'};
					https.get(link, res => {
						let html = '';
						res.on('data', chunk => {
							html += chunk;
						});
						res.on('end', () => {
							if (res.statusCode === 200) {
								let htmlDOM = new jsdom.JSDOM(html);
								let doc = htmlDOM.window.document;
								let imageLink = 'https://apod.nasa.gov/' + doc.querySelector('img').getAttribute('src');
								let explaination = doc.querySelectorAll('p')[2].textContent.replace(/(\r\n|\n|\r)/gm, " ");
								msg.channel.send(explaination + '\n' + imageLink);
							}
							else if (res.statusCode !== 200) {
								msg.channel.send('L\'erreur ' + res.statusCode + ' est survenue. Veuillez réessayer');
							}
						})
					})
				}
				else {
					msg.channel.send(wrongChannel)
				}
			}

			// Commande clear, retire les x derniers message du channel où elle à été envoyée
			else if (cmd === 'clear') {
				if (!msg.member.hasPermission('MANAGE_MESSAGES')) {
					return msg.channel.send('Tu n\'as pas la permission d\'utiliser cette commande');
				}
				if (!isNaN(args[0]) && args[0] < 100 && args[0] > 0) {
					if (!args[0]) {
						msg.channel.bulkDelete(6);
						msg.channel.send(5 + ' messages ont été supprimés');
					}
					if (args[0]) {
						nbMessageToDelete = args[0];
						nbMessageToDelete ++;
						msg.channel.messages.fetch({ limit: nbMessageToDelete }).then(messages => {
							msg.channel.bulkDelete(messages);
							nbMessageToDelete --;
							msg.channel.send(nbMessageToDelete + ' messages ont été supprimés');
						});
					}
				}
				else {
					msg.channel.send('Vous devez écrire un nombre supérieur à 0 et inférieur à 100 pour utiliser cette commande')
				}
			}

			// Commande mute, permet de mute vocalement ou textuellement un membre en lui attribuant le role mute text ou le role mute vocal
			else if (cmd === 'mute') {
				if (msg.member.hasPermission('MUTE_MEMBERS')) {
					if (msg.mentions.members.first()) {
						let mentioned = '<@!' + msg.mentions.members.first().id + '>';
						if (msg.mentions.members.first() === undefined && args.length > 0) {
							msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
						}
						else if (args[0] === undefined || args[0] === mentioned) {
							msg.channel.send('Il faut préciser un argument **puis** mentionner la personne à mute');
						}
						else {
							let memberTarget = msg.mentions.members.first();
							let muteTextRole = process.env.muteTextRoleId;
							let muteVocalRole = process.env.muteVocalRoleId;
							if (args[0].toLowerCase() === 'text' || args[0].toLowerCase() === 'texte' || args[0].toLowerCase() === 't') {
								memberTarget.roles.add(muteTextRole);
								msg.channel.send(mentioned + ' a été mute par <@!' + msg.author + '>');
							}
							else if (args[0].toLowerCase() === 'vocal' || args[0].toLowerCase() === 'v') {
								memberTarget.roles.add(muteVocalRole);
								msg.channel.send(mentioned + ' a été mute par <@!' + msg.author + '>');
							}
							else if (args[0].toLowerCase() === 'vt' || args[0].toLowerCase() === 'tv') {
								memberTarget.roles.add(muteTextRole);
								memberTarget.roles.add(muteVocalRole);
								msg.channel.send(mentioned + ' a été mute par <@!' + msg.author + '>');
							}
							else {
								msg.channel.send('L\'argument que tu as spécifié est invalide');
							}
						}
					}
					else {
						msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
					}
				}
				else {
					msg.channel.send('Tu n\'as pas la permission d\'utiliser cette commande');
				}
			}

			// Commande demute/unmute, permet de retirer le role muteText et/ou muteVocal d'un membre
			else if (cmd === 'demute' || cmd === 'unmute') {
				if (msg.member.hasPermission('MUTE_MEMBERS')) {
					if (msg.mentions.members.first()) {
						let mentioned = '<@!' + msg.mentions.members.first().id + '>';
						if (msg.mentions.members.first() === undefined && args.length > 0) {
							msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
						}
						else if (args[0] === undefined || args[0] === mentioned) {
							msg.channel.send('Il faut préciser un argument **puis** mentionner la personne à mute');
						}
						else {
							let memberTarget = msg.mentions.members.first();
							let muteTextRole = process.env.muteTextRoleId;
							let muteVocalRole = process.env.muteVocalRoleId;
							if (args[0].toLowerCase() === 'text' || args[0].toLowerCase() === 'texte' || args[0].toLowerCase() === 't') {
								memberTarget.roles.remove(muteTextRole);
								msg.channel.send(mentioned + ' a été ' + cmd + ' par <@!' + msg.author + '>');
							}
							else if (args[0].toLowerCase() === 'vocal' || args[0].toLowerCase() === 'v') {
								memberTarget.roles.remove(muteVocalRole);
								msg.channel.send(mentioned + ' a été ' + cmd + ' par <@!' + msg.author + '>');
							}
							else if (args[0].toLowerCase() === 'vt' || args[0].toLowerCase() === 'tv') {
								memberTarget.roles.remove(muteTextRole);
								memberTarget.roles.remove(muteVocalRole);
								msg.channel.send(mentioned + ' a été ' + cmd + ' par <@!' + msg.author + '>');
							}
							else {
								msg.channel.send('L\'argument que tu as spécifié est invalide');
							}
						}
					}
					else {
						msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
					}
				}
				else {
					msg.channel.send('Tu n\'as pas la permission d\'utiliser cette commande');
				}
			}

			// Commande ban, permet de simuler le bannissement d'un membre en lui attibuant le role banned
			else if (cmd === 'ban') {
				if (!msg.member.hasPermission('BAN_MEMBERS')) {
					msg.channel.send('Tu n\'as pas la permission d\'utiliser cette commande');
				}
				else if (args[0] === undefined || msg.mentions.members.first() === undefined) {
					msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
				}
				else {
					let memberTarget = msg.mentions.members.first();
					let bannedRole = process.env.bannedRoleId;
					memberTarget.roles.add(bannedRole);
					msg.channel.send('<@!' + memberTarget + '> a été banni par <@!' + msg.author + '>');
				}
			}

			// Commande deban/unban, permet de retirer le role banned d'un membre
			else if (cmd === 'deban' || cmd === 'unban') {
				if (!msg.member.hasPermission('BAN_MEMBERS')) {
					msg.channel.send('Tu n\'as pas la permission d\'utiliser cette commande');
				}
				else if (args[0] === undefined || msg.mentions.members.first() === undefined) {
					msg.channel.send('Il faut mentionner quelqu\'un pour utiliser cette commande');
				}
				else {
					let memberTarget = msg.mentions.members.first();
					let bannedRole = process.env.bannedRoleId;
					memberTarget.roles.remove(bannedRole);
					msg.channel.send('<@!' + memberTarget + '> a été ' + cmd + 'ni par <@!' + msg.author + '>');
				}
			}

			// Commande insult, pierre edouard insult la personne tag dans la commande
			else if (cmd === 'insult') {
				if (msg.channel.id === process.env.leBordelChannelId || msg.channel.id === process.env.twitchBotChannelId) {
					if (msg.mentions.roles.first() !== undefined) {
						msg.channel.send('T\'es fou <@!' + msg.author + '> ? Faut pas mentionner un rôle, je veux pas me faire déglinguer parce que j\'ai fait une généralité');
					}
					else if (args[0] === undefined || msg.mentions.members.first() === undefined) {
						msg.channel.send('Non mais t\'es con <@!' + msg.author + '> ? Faut mentionner quelqu\'un si tu veux que je l\'insulte');
					}
					else {
						if (msg.mentions.members.first().id === process.env.pierreEdouardId) {
							msg.channel.send('T\'as cru quoi <@!' + msg.author + '> ? Je vais pas m\'insulter moi même je suis pas con...');
						}
						else {
							// msg.channel.bulkDelete(1);
							let memberTarget = msg.mentions.members.first().id;
							let insultNumber = getRandomInt(insultList.list.length);
							let insultString = insultList.list[insultNumber].replace('@!memberTarget', '<@!' + memberTarget + '>');
							msg.channel.send(insultString);
						}
					}
				}
				else {
					msg.channel.send(wrongChannel)
				}
			}

			// Commande pick4me, le bot donne un champion, une rune principale, et un item mythic aléatoire
			else if (cmd === 'pick4me') {
				if (msg.channel.id === process.env.leBordelChannelId || msg.channel.id === process.env.twitchBotChannelId || msg.channel.id === process.env.leagueOfLegendsChannelId) {
					let rdmChampion = getRandomInt(pick4meList.champion.length);
					let rdmRune = getRandomInt(pick4meList.rune.length);
					let rdmItem = getRandomInt(pick4meList.item.length);
					let championString = pick4meList.champion[rdmChampion];
					let runeString = pick4meList.rune[rdmRune];
					let itemString = pick4meList.item[rdmItem];
					msg.channel.send('Aujourd\'hui, tu vas jouer **' + championString + '** avec la Rune **' + runeString + '** et avec comme Item mythic, **' + itemString + '**');
				}
				else {
					msg.channel.send(wrongChannel)
				}
			}

			// Commande build, envoie la page op.gg du champion demandé
			else if (cmd === 'build') {
				if (msg.channel.id === process.env.leBordelChannelId || msg.channel.id === process.env.twitchBotChannelId || msg.channel.id === process.env.leagueOfLegendsChannelId) {
					if (args.length > 0) {
						let askedChampion = args[0];
						let askedRole = args[(args.length - 1)];
						for (i = 1; i < (args.length - 1); i++) {
							askedChampion += args[i];
						}
						askedChampion = normalizeChampionBuildList(askedChampion);
						if (!championBuildList['list'].includes(askedChampion)) {
							msg.channel.send('Le nom du champion doit être éronné, ma base de donnée ne contient pas de champion avec ce nom');
						}
						else if (!lolRoleList.includes(askedRole)) {
							msg.channel.send('Le role spécifié n\'exsite pas essayer avec l\'un de ces rôles : top, jungle, mid, adc, support');
						}
						else if (championBuildList['list'].includes(askedChampion)) {
							let opggLinkBuild = {host: 'euw.op.gg', path: '/champion/' + askedChampion + '/statistics/' + askedRole};
							let opggCompleteLink = 'https://euw.op.gg/champion/' + askedChampion + '/statistics/' + askedRole;

							https.get(opggLinkBuild, res => {
								let html = '';
								res.on('data', chunk => {
									html += chunk;
								});
								res.on('end', () => {
									if (res.statusCode === 200) {
										let htmlDOM = new jsdom.JSDOM(html);
										let doc = htmlDOM.window.document;
										
										if (doc.getElementsByClassName('champion-stats-trend-rate')[0].innerHTML.trim().length > 1) {
											let mainTreeRunes = [];
											let mainTree = 'yousk';
											for (var i = 0; i < 4; i++) {
												mainTreeRunes.push(doc.querySelectorAll('.champion-overview__table')[2].querySelector('.tabItem .perk-page-wrap').querySelectorAll('.perk-page')[0].querySelectorAll('.perk-page__item--active')[i].querySelector('img').getAttribute('alt') + '\n');
											}
											mainTree = mainTreeRunes.toString().replace(/,/g, '');
											
											let secondaryTreeRunes = [];
											let secondaryTree = 'yousk';
											for (var i = 0; i < 2; i++) {
												secondaryTreeRunes.push(doc.querySelectorAll('.champion-overview__table')[2].querySelector('.tabItem .perk-page-wrap').querySelectorAll('.perk-page')[1].querySelectorAll('.perk-page__item--active')[i].querySelector('img').getAttribute('alt') + '\n');
											}
											secondaryTree = secondaryTreeRunes.toString().replace(/,/g, '');

											let spellOrder = '';
											for (var i = 0; i < 3; i++) {
												if (doc.querySelectorAll('.champion-overview__data')[2].childNodes[1].querySelectorAll('li.champion-stats__list__item')[i].querySelector('span') !== null) {
													spellOrder += doc.querySelectorAll('.champion-overview__data')[2].childNodes[1].querySelectorAll('li.champion-stats__list__item')[i].querySelector('span').innerHTML;
													spellOrder += ' > ';
												}
											}
											spellOrder = spellOrder.slice(0, 9);

											let startItemList = [];
											let startItem = '';
											startItemDOM = doc.querySelectorAll('.champion-overview__table')[1].querySelector('tbody').querySelectorAll('tr.champion-overview__row.champion-overview__row--first')[0].querySelector('td').querySelector('ul').querySelectorAll('img');
											for (var i = 0; i < startItemDOM.length; i++) {
												let startItemId = startItemDOM[i].getAttribute('src').slice(44, -35);
												startItemList.push(startItemId);
												startItem += buildItemsCorres.starterItemCorres[startItemList[i]] + '\n';
											}

											let mythicItem = 'yousk';
											mythicItem = doc.querySelectorAll('.champion-overview__table')[1].querySelector('tbody').querySelectorAll('tr.champion-overview__row.champion-overview__row--first')[1].querySelector('td').querySelector('ul').querySelectorAll('img')[0].getAttribute('src').slice(44, -35);
											mythicItem = buildItemsCorres.mythicItemCorres[mythicItem];

											let boots = 'yousk';
											boots = doc.querySelectorAll('.champion-overview__table')[1].querySelector('tbody').querySelectorAll('tr.champion-overview__row.champion-overview__row--first')[2].querySelector('td').querySelector('ul').querySelectorAll('img')[0].getAttribute('src').slice(44, -35);
											boots = buildItemsCorres.bootsCorres[boots];

											let sumSpell = 'yousk';
											sumSpell = doc.querySelectorAll('.champion-overview__table')[0].querySelector('tbody').querySelector('.champion-overview__data').querySelector('ul').querySelectorAll('img')[0].getAttribute('src').slice(53, -43) + ', ' + doc.querySelectorAll('.champion-overview__table')[0].querySelector('tbody').querySelector('.champion-overview__data').querySelector('ul').querySelectorAll('img')[1].getAttribute('src').slice(53, -43)

											let winRate = 'Le champion n\'a pas de win rate à ce rôle';
											winRate = doc.getElementsByClassName('champion-stats-trend-rate')[0].innerHTML;

											let champToBan = 'yousk'
											champToBan = doc.querySelector('.champion-stats-header-matchup__table__champion').innerHTML.slice(doc.querySelector('.champion-stats-header-matchup__table__champion').innerHTML.indexOf('>') + 1,-10);

											let embed = {
												"title": "Build de @askedChampion",
												"description": "D'après op.gg, les meilleurs items et runes en ce moment sont :",
												"url": "@opggCompleteLink",
												"color": 3306490,
												"fields": [
													{
													"name": "Arbre Principal",
													"value": "@mainTree",
													"inline": true
													},
													{
													"name": "Arbre Secondaire",
													"value": "@secondaryTree",
													"inline": true
													},
													{
													"name": "Ordre des spells",
													"value": "@spellOrder"
													},
													{
													"name": "Item de départ",
													"value": "@startItem",
													"inline": true
													},
													{
													"name": "Item Mythique",
													"value": "@mythicItem",
													"inline": true
													},
													{
													"name": "Bottes",
													"value": "@boots",
													"inline": true
													},
													{
													"name": "Sorts d'invocateur",
													"value": "@sumSpell",
													},
													{
													"name": "Win Rate",
													"value": "@winRate",
													"inline": true
													},
													{
													"name": "Champion to ban",
													"value": "@champToBan",
													"inline": true
													}
												]
											}

											embed.title = embed.title.replace('@askedChampion', askedChampion.charAt(0).toUpperCase() + askedChampion.substring(1));
											embed.url = embed.url.replace('@opggCompleteLink',opggCompleteLink);
											embed.fields[0].value = embed.fields[0].value.replace('@mainTree', mainTree);
											embed.fields[1].value = embed.fields[1].value.replace('@secondaryTree', secondaryTree);
											embed.fields[2].value = embed.fields[2].value.replace('@spellOrder', spellOrder);
											embed.fields[3].value = embed.fields[3].value.replace('@startItem', startItem);
											embed.fields[4].value = embed.fields[4].value.replace('@mythicItem', mythicItem);
											embed.fields[5].value = embed.fields[5].value.replace('@boots', boots);
											embed.fields[6].value = embed.fields[6].value.replace('@sumSpell', sumSpell);
											embed.fields[7].value = embed.fields[7].value.replace('@winRate', winRate);
											embed.fields[8].value = embed.fields[8].value.replace('@champToBan', champToBan);
											msg.channel.send({embed});
										}
										else {
											let embedFail = {
												"title": "Build de @askedChampion",
												"description": "Le build de ce champion n'est pas accessible depuis discord. Tu peux tout de même y accéder en cliquant sur le titre du message ! ",
												"url": "@opggCompleteLink",
												"color": 3306490,
												"fields": []
											}
											embedFail.title = embedFail.title.replace('@askedChampion', askedChampion.charAt(0).toUpperCase() + askedChampion.substring(1));
											embedFail.url = embedFail.url.replace('@opggCompleteLink',opggCompleteLink);
											msg.channel.send({embed:embedFail});
										}
									}
									else if (res.statusCode !== 200) {
										msg.channel.send('L\'erreur ' + res.statusCode + ' est survenue. Veuillez réessayer');
									}
								});
							});
						}
					}
				}
				else {
					msg.channel.send(wrongChannel);
				}
			}

			// Commande livegame, envoi la page live game de u.gg
			else if (cmd === 'livegame') {
				if (msg.channel.id === process.env.leBordelChannelId || msg.channel.id === process.env.twitchBotChannelId || msg.channel.id === process.env.leagueOfLegendsChannelId) {
					if (args[0] === 'set' && args.length === 3) {
						if (args.length === 3 && lolServerList.includes(args[1])) {
							let playerServer = args[1];
							let inGameName = args[2].toLowerCase();
							let uggLinkLivegame = 'https://u.gg/lol/profile/' + playerServer + '/' + inGameName + '/live-game';
							liveGameList[msg.author.id] = uggLinkLivegame;
							let liveGameListPush = JSON.stringify(liveGameList, null, 4);
							fs.writeFile("./liveGameList.json", liveGameListPush, () => console.error);
							msg.channel.send('Votre lien a bien été mis à jour. Vous pouvez désormais utiliser la commande -livegame pour avoir accès à votre lien');
						}
						else if (!lolServerList.includes(args[1])) {
							msg.channel.send('Le serveur que vous avez spécifié n\'existe pas');
						}
						else {
							msg.channel.send('Vous avez spécifié trop d\'arguments, veuillez relire votre commande puis réessayer');
						}
					}
					else if (args.length === 0 && liveGameList.hasOwnProperty(msg.author.id)) {
						msg.channel.send('Le lien u.gg de votre partie est : ' + liveGameList[msg.author.id]);
					}
					else if (msg.mentions.members.first() !== undefined) {
						msg.channel.send('Le lien u.gg de la partie de <@!' + msg.mentions.members.first().id + '> est : ' + liveGameList[msg.mentions.members.first().id]);
					}
					else {
						msg.channel.send('Vous n\'êtes pas enregistré sur la liste, voici la commande a écrire : -livegame set <server> <ign>', {files: ["./images/uggLinkLivegame.png"]});
					}
				}
				else {
					msg.channel.send(wrongChannel);
				}
			}

			// Commande updatecount, met a jour le nombre de membre du serveur dans le fichier config et sur le saslon qui display le nombre de membre sur le serveur
			else if (cmd === 'updatecount') {
				if (msg.channel.id === process.env.leBordelChannelId || msg.channel.id === process.env.twitchBotChannelId) {
					let memberCountChannel = client.channels.cache.get(process.env.memberCountChannelId);
					config['memberCount'] = msg.guild.memberCount;
					let memberCountPush = JSON.stringify(config, null, 4);
					fs.writeFile("./configFiles/config.json", memberCountPush, () => console.error);
					memberCountChannel.setName('Membres : ' + config['memberCount']);
					msg.channel.send('Le nombre de membre a été mis à jour');
				}
				else {
					msg.channel.send(wrongChannel);
				}
			}
		}
	}
});