// TODO: ADD COMMENTS TO THIS MONSTROSITY
String.prototype.hashCode = function(){
    var hash = 0;
    if (this.length == 0) return hash;
    for (i = 0; i < this.length; i++) {
        char = this.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

var nbaLineupApp = angular.module('nbaLineupApp', ['ngSanitize', 'ui.select', 'ui.bootstrap', 'ngRoute']);

// Service to format results from NBA API results 
// are returned as an Object with a list of headers
// and a list of lists, where the values at each index 
// are keyed to the header at the same index
// 
// generateListOfObjects:
// Use underscore JS to return this as a list of objects
// with the right key-value pairs.
//
months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
nbaLineupApp.service('formatAPIResults', function() {
    var formattingService = {
        generateListOfObjects: function(headers, list) {
            return _.map(list, function(listInList) {
                return _.object(headers, listInList)
            })
        },

        addNameKeys: function(eligiblePlayerObjects) {
            eligiblePlayerObjects = _.map(eligiblePlayerObjects, function(playerObject) {
                // console.log("playerObject", playerObject)
                var nameComponents = playerObject.PLAYER_NAME.split(" ");
                    playerObject.firstName = nameComponents[0];
                    playerObject.lastName = "";
                    if (nameComponents.length == 1) {
                        playerObject.lastName = nameComponents[0];
                        playerObject.fullName = nameComponents[0];
                    } 
                    else {
                        for (i = 1; i < nameComponents.length; i++) { 
                            if (i > 2)
                                playerObject.lastName += " "
                            playerObject.lastName += nameComponents[i];
                        }
                        playerObject.fullName = playerObject.firstName + ' ' + playerObject.lastName;
                    }
                
                return playerObject;
            })

            return eligiblePlayerObjects;
        },

        settingsToQueryParams: function(paramName, settingsObject, queryParams) {
            var settingsObjectAsListOfPairs = _.pairs(settingsObject);
            var filterTrueSettings = _.filter(settingsObjectAsListOfPairs, function(pair) { return pair[1]; })
            var listQueryParamValues = _.map(filterTrueSettings, _.first);
            queryParams[paramName] = listQueryParamValues;
            return queryParams;
        }, 

        /**
         * Return a timestamp with the format "m/d/yy "
         * @type {Date}
         */

        timeStamp: function(date_string) {
        // Create a date object with the current time
          var d = new Date(date_string);

        // Create an array with the current month, day and time
          var date = [ d.getMonth(), d.getUTCDate(), d.getFullYear() ];

        // Return the formatted string
          return months[date[0]] + " " + date[1] + ", " + date[2];
        }
    };
    return formattingService;
})

nbaLineupApp.factory('teamData', function() {
    var teamData = {};
    teamData['teams'] = [{'id': 0, 'lineups': [], 'roster': []},{'id': 0,'lineups': [], 'roster':[]}];

    teamData.addTeamLineups = function(team_num, lineups) {
        teamData.teams[team_num].lineups = lineups;
    }
    teamData.addTeamRoster = function(team_num, roster) {
        teamData.teams[team_num].roster = roster;
    }
    teamData.addTeamId = function(team_num, teamID) {
        teamData.teams[team_num].id = teamID;
    }

    return teamData;
})

nbaLineupApp.factory('gameStateMachine', function() {
    var state = {};
    
    state.getStartState = function(teamID, players) {
        // var players = state.players;

        var test  = _.filter(players, function(player) {
                    return player.TEAM_ID ==  teamID;
                })
        return test;
    }   

    state.evaluateState = function(play, lineup, players) {
        
        if (play.EVENTMSGACTIONTYPE == 0 && play.EVENTMSGTYPE == 8) {
            var team = play.PLAYER1_TEAM_ID;
            if (team == lineup[0].TEAM_ID) {
                var playerIn = play.PLAYER2_ID;
                var playerOut = play.PLAYER1_ID;
                var playerInObject = _.find(players, function(player) {
                    return (player.PLAYER_ID == playerIn);
                })
                var playerOutObject = _.find(players, function(player) {
                    return (player.PLAYER_ID == playerOut);
                })
                // console.log(state.lineups[team_num], playerInObject, playerOutObject);
                // this.lineups[team_num] = [];
                return _.map(lineup,function(player) {
                    if (player.PLAYER_ID == playerOutObject.PLAYER_ID) {
                        return player = playerInObject;
                    }
                    else return player
                })
            }
            else return lineup
        }
        else return lineup;
    }
    return state;


})

nbaLineupApp.service('lineupStats', function() {
    var statGetter = {
        getTimePlayed: function(plays){
            if (plays) {
                if (plays.length) {
                    // console.log('called');
                    var seconds = 0;
                    var prevTime = plays[0].PCTIMESTRING.split(":");
                    var currentTime = "";
                    var prevPlayMin = 0;
                    var prevPlaySeconds = 0;
                    var currentPlayMin = 0;
                    var currentPlaySeconds = 0;
                    var prevEvent = plays[0].EVENTNUM-1;
                    var period = plays[0].PERIOD;
                    _.each(plays, function(play) {

                        if (play.EVENTNUM > prevEvent + 3 || play.PERIOD != period) {
                            prevTime = play.PCTIMESTRING.split(":");
                            period = play.PERIOD;
                        }
                        currentTime = play.PCTIMESTRING.split(":");
                        currentPlayMin = parseInt(currentTime[0])
                        currentPlaySeconds = parseInt(currentTime[1])
                        prevPlayMin = parseInt(prevTime[0])
                        prevPlaySeconds = parseInt(prevTime[1])
                        
                        if (prevPlaySeconds < currentPlaySeconds) {
                            prevPlayMin--;
                            prevPlaySeconds+=60;
                        }
                        seconds += 60*(prevPlayMin-currentPlayMin) + (prevPlaySeconds - currentPlaySeconds)
                        prevTime = currentTime;
                        prevEvent = play.EVENTNUM;
                    })
                    if (seconds%60 > 9)
                        return Math.floor(seconds/60).toString() + ":" + (seconds%60).toString();
                    else
                        return Math.floor(seconds/60).toString() + ":0" + (seconds%60).toString();
                }
                else return "0:00";
            }
            else return "0:00";
        },
        getPoints: function(plays) {
            var homeScore = 0;
            var visitorScore = 0;
            var addToScore = 0;
            var homeMade = 0;
            var homeAttempted = 0;
            var visitorMade = 0;
            var visitorAttempted = 0;
            var homeMadeThrees = 0;
            var homeAttemptedThrees = 0;
            var visitorMadeThrees = 0;
            var visitorAttemptedThrees = 0;
            var homeMadeFreeThrows = 0;
            var homeAttemptedFreeThrows = 0;
            var visitorMadeFreeThrows = 0;
            var visitorAttemptedFreeThrows = 0;
            _.each(plays, function(play) {
                if (play.SCORE != null) { 
                    if (play.HOMEDESCRIPTION) {
                        if (play.HOMEDESCRIPTION.indexOf("3PT") != -1) {
                            addToScore = 3;
                            homeMadeThrees++;
                            homeAttemptedThrees++;
                            homeMade++;
                            homeAttempted++;
                        }
                        else if (play.HOMEDESCRIPTION.indexOf("Free Throw") != -1) {
                            addToScore = 1
                            homeMadeFreeThrows++;
                            homeAttemptedFreeThrows++;
                        }
                        else {
                            addToScore = 2; 
                            homeMade++;
                            homeAttempted++;
                            
                        } 
                        homeScore += addToScore; 
                    }
                    if (play.VISITORDESCRIPTION) {
                        if (play.VISITORDESCRIPTION.indexOf("3PT") != -1) {
                            addToScore = 3;
                            visitorMadeThrees++;
                            visitorAttemptedThrees++;
                            visitorMade++;
                            visitorAttempted++;
                        }
                        else if (play.VISITORDESCRIPTION.indexOf("Free Throw") != -1) {
                            addToScore = 1;
                            visitorMadeFreeThrows++;
                            visitorAttemptedFreeThrows++;
                        }
                        else {
                            addToScore = 2;
                            visitorMade++;
                            visitorAttempted++;
                            
                        }
                        visitorScore += addToScore;
                    }
                }
                else {
                    if (play.HOMEDESCRIPTION) {
                        if (play.HOMEDESCRIPTION.indexOf("MISS") == 0) {
                            if (play.HOMEDESCRIPTION.indexOf("Free Throw") != -1) {
                                homeAttemptedFreeThrows++;
                            }
                            else {
                                homeAttempted++;
                                if(play.HOMEDESCRIPTION.indexOf("3PT") != -1) {
                                    homeAttemptedThrees++;
                                }
                            }   
                            
                        }
                        
                    }
                    if (play.VISITORDESCRIPTION) {
                        if (play.VISITORDESCRIPTION.indexOf("MISS") == 0) {
                            if (play.VISITORDESCRIPTION.indexOf("Free Throw") != -1) {
                                visitorAttemptedFreeThrows++;
                            }
                            else {
                                visitorAttempted++;
                                if(play.VISITORDESCRIPTION.indexOf("3PT") != -1) {
                                    visitorAttemptedThrees++;
                                }
                            }
                                
                        }
                            
                    }
                }
            });

            var homePct = (homeMade/homeAttempted*100).toFixed() + "%"
            var homeThreePct = (homeMadeThrees/homeAttemptedThrees*100).toFixed() + "%"
            var homeFTPct = (homeMadeFreeThrows/homeAttemptedFreeThrows*100).toFixed() + "%"
            var visitorPct = (visitorMade/visitorAttempted*100).toFixed() + "%"
            var visitorThreePct = (visitorMadeThrees/visitorAttemptedThrees*100).toFixed() + "%"
            var visitorFTPct = (visitorMadeFreeThrows/visitorAttemptedFreeThrows*100).toFixed() + "%"
            if (homePct == "NaN%") homePct = "N/A"
            if (visitorPct == "NaN%") visitorPct = "N/A"
            if (homeThreePct == "NaN%") homeThreePct = "N/A"
            if (visitorThreePct == "NaN%") visitorThreePct = "N/A"
            if (homeFTPct == "NaN%") homeFTPct = "N/A"
            if (visitorFTPct == "NaN%") visitorFTPct = "N/A"
            return {
                    'home': {
                        'score': homeScore,
                        'fgp': homeMade.toString() + "/" + homeAttempted.toString() + " (" + homePct + ")",
                        'threefgp': homeMadeThrees.toString() + "/" + homeAttemptedThrees.toString() + " (" + homeThreePct + ")",
                        'ftp': homeMadeFreeThrows.toString() + "/" + homeAttemptedFreeThrows.toString() + " (" + homeFTPct + ")"
                    }, 
                    'visitor': {
                        'score': visitorScore,
                        'fgp': visitorMade.toString() + "/" + visitorAttempted.toString() + " (" + visitorPct + ")",
                        'threefgp': visitorMadeThrees.toString() + "/" + visitorAttemptedThrees.toString() + " (" + visitorThreePct + ")",
                        'ftp': visitorMadeFreeThrows.toString() + "/" + visitorAttemptedFreeThrows.toString() + " (" + visitorFTPct + ")"
                    }
                }
            },
        getTO: function(plays) {
            var homeTO = 0;
            var visitorTO = 0;
            _.each(plays, function(play) {
                if (play.EVENTMSGTYPE == 5) {
                    if (play.HOMEDESCRIPTION) {
                        if (play.HOMEDESCRIPTION.indexOf('Turnover') != -1) homeTO++;
                    }
                    if (play.VISITORDESCRIPTION) {
                        if (play.VISITORDESCRIPTION.indexOf('Turnover') != -1) visitorTO++;
                    }
                }
            })
            return {home: homeTO, visitor: visitorTO};
        }
    }
    return statGetter;
})

nbaLineupApp.service('nbaAPI', function($http, formatAPIResults){
    
    var getterService = {

        getAllTeams: function() {
            return([
                {
                    id: 1610612737,
                    teamName: "Atlanta Hawks",
                    abbrev: "ATL"
                }, {
                    id: 1610612738,
                    teamName: "Boston Celtics",
                    abbrev: "BOS"
                }, {
                    id: 1610612751,
                    teamName: "Brooklyn Nets",
                    abbrev: "BRK"
                }, {
                    id: 1610612766,
                    teamName: "Charlotte Hornets",
                    abbrev: "CHA"
                }, {
                    id: 1610612741,
                    teamName: "Chicago Bulls",
                    abbrev: "CHI"
                }, {
                    id: 1610612739,
                    teamName: "Cleveland Cavaliers",
                    abbrev: "CLE"
                }, {
                    id: 1610612742,
                    teamName: "Dallas Mavericks",
                    abbrev: "DAL"
                }, {
                    id: 1610612743,
                    teamName: "Denver Nuggets",
                    abbrev: "DEN"
                }, {
                    id: 1610612765,
                    teamName: "Detroit Pistons",
                    abbrev: "DET"
                }, {
                    id: 1610612744,
                    teamName: "Golden State Warriors",
                    abbrev: "GSW"
                }, {
                    id: 1610612745,
                    teamName: "Houston Rockets",
                    abbrev: "HOU"
                }, {
                    id: 1610612754,
                    teamName: "Indiana Pacers",
                    abbrev: "IND"
                }, {
                    id: 1610612746,
                    teamName: "Los Angeles Clippers",
                    abbrev: "LAC"
                }, {
                    id: 1610612747,
                    teamName: "Los Angeles Lakers",
                    abbrev: "LAL"
                }, {
                    id: 1610612763,
                    teamName: "Memphis Grizzlies",
                    abbrev: "MEM"
                }, {
                    id: 1610612748,
                    teamName: "Miami Heat",
                    abbrev: "MIA"
                }, {
                    id: 1610612749,
                    teamName: "Milwaukee Bucks",
                    abbrev: "MIL"
                }, {
                    id: 1610612750,
                    teamName: "Minnesota Timberwolves",
                    abbrev: "MIN"
                }, {
                    id: 1610612740,
                    teamName: "New Orleans Pelicans",
                    abbrev: "NOP"
                }, {
                    id: 1610612752,
                    teamName: "New York Knicks",
                    abbrev: "NYK"
                }, {
                    id: 1610612760,
                    teamName: "Oklahoma City Thunder",
                    abbrev: "OKC"
                }, {
                    id: 1610612753,
                    teamName: "Orlando Magic",
                    abbrev: "ORL"
                }, {
                    id: 1610612755,
                    teamName: "Philadelphia 76ers",
                    abbrev: "PHI"
                }, {
                    id: 1610612756,
                    teamName: "Phoenix Suns",
                    abbrev: "PHX"
                }, {
                    id: 1610612757,
                    teamName: "Portland Trail Blazers",
                    abbrev: "POR"
                }, {
                    id: 1610612758,
                    teamName: "Sacramento Kings",
                    abbrev: "SAC"
                }, {
                    id: 1610612759,
                    teamName: "San Antonio Spurs",
                    abbrev: "SAS"
                }, {
                    id: 1610612761,
                    teamName: "Toronto Raptors",
                    abbrev: "TOR"
                }, {
                    id: 1610612762,
                    teamName: "Utah Jazz",
                    abbrev: "UTA"
                }, {
                    id: 1610612764,
                    teamName: "Washington Wizards",
                    abbrev: "WAS"
                }
            ])
            
        },
        getTeam:function(teamID) {
            return _.findWhere(getterService.getAllTeams(), {id: teamID});
        },

        addNameKeys: function(players) {
            return formatAPIResults.addNameKeys(players);
        },

        getLineups:function(teamID, season, seasonType) {
            var teamLineupsUrl = "http://stats.nba.com/stats/teamdashlineups"
            var requiredParams = {
                "DateFrom": "",
                "DateTo": "",
                "GameID": "",
                "GameSegment":"",
                "GroupQuantity":"5",
                "LastNGames":"0",
                "LeagueID":"00",
                "Location":"",
                "MeasureType":"Base",
                "Month":"0",
                "OpponentTeamID":"0",
                "Outcome":"",
                "PaceAdjust":"N",
                "PerMode":"Totals",
                "Period":"0",
                "PlusMinus":"N",
                "Rank":"N",
                "SeasonSegment":"",
                "TeamID":teamID,
                "VsConference":"",
                "VsDivision":"",
                "Season": season,
                "SeasonType": seasonType,
                "callback":"JSON_CALLBACK"
                

            }
            var promise = $http.jsonp(teamLineupsUrl, { "params": requiredParams}).then(function(response) {
                var headers = response.data.resultSets[1].headers;
                var lineups = response.data.resultSets[1].rowSet;
                var lineupObjects = formatAPIResults.generateListOfObjects(headers, lineups);
                return lineupObjects;
            });
            return promise;

        },

        getRoster: function(teamID,season, seasonType) {
            var rosterUrl = "http://stats.nba.com/stats/teamplayerdashboard"
            var requiredParams = {  
              "MeasureType":"Base",
              "PerMode":"PerGame",
              "PlusMinus":"N",
              "PaceAdjust":"N",
              "Rank":"N",
              "LeagueID":"00",
              "Season":season,
              "SeasonType":seasonType,
              "PORound":"",
              "TeamID":teamID,
              "Outcome":"",
              "Location":"",
              "Month":"0",
              "SeasonSegment":"",
              "DateFrom":"",
              "DateTo":"",
              "OpponentTeamID":"0",
              "VsConference":"",
              "VsDivision":"",
              "GameSegment":"",
              "Period":"0",
              "ShotClockRange":"",
              "LastNGames":"0",
              "callback":"JSON_CALLBACK"
           } 
           var promise = $http.jsonp(rosterUrl, { "params": requiredParams}).then(function(response) {
                var headers = response.data.resultSets[1].headers;
                var players = response.data.resultSets[1].rowSet;
                var playerObjects = formatAPIResults.generateListOfObjects(headers, players);
                return playerObjects;
            });
            return promise;
        },

        getGamesForTeam: function(teamID, season, seasonType) {
             var gameLogForPlayerUrl = "http://stats.nba.com/stats/teamgamelog";
             var requiredParams = {  
                "Season":season,
                "SeasonType":seasonType,
                "TeamID":teamID,
                "callback":"JSON_CALLBACK"
            } 
             var promise = $http.jsonp(gameLogForPlayerUrl, { "params": requiredParams}).then(function(response) {
                var headers = response.data.resultSets[0].headers;
                var games = response.data.resultSets[0].rowSet;
                var gameObjects = formatAPIResults.generateListOfObjects(headers, games);
                return gameObjects;
            });
            return promise;
         },

        getGameLogForPlayer: function(playerID, season, seasonType) {
            var gameLogForPlayerUrl = "http://stats.nba.com/stats/playergamelog"
            var requiredParams ={  
                "PlayerID": playerID,
                "LeagueID":"00",
                "Season":season,
                "SeasonType":seasonType,
                "callback":"JSON_CALLBACK"
            }
            var promise = $http.jsonp(gameLogForPlayerUrl, { "params": requiredParams}).then(function(response) {
                var headers = response.data.resultSets[0].headers;
                var games = response.data.resultSets[0].rowSet;
                var playerObjects = formatAPIResults.generateListOfObjects(headers, games);
                return playerObjects;
            });
            return promise;
        },

        getGamePlayByPlay: function(gameID, season, seasonType, startPeriod, endPeriod) {
            var gamePlayByPlayUrl = "http://stats.nba.com/stats/playbyplayv2"
            var requiredParams = {
                "EndPeriod": endPeriod,
                "RangeType":"2",
                "Season": season,
                "SeasonType": seasonType,
                "StartPeriod": startPeriod,
                "GameID": gameID,
                "callback": "JSON_CALLBACK"
            }

            var promise = $http.jsonp(gamePlayByPlayUrl,{ "params": requiredParams}).then(function(response) {
                var headers = response.data.resultSets[0].headers;
                var playList = response.data.resultSets[0].rowSet;
                var playObjects = formatAPIResults.generateListOfObjects(headers, playList);

                return playObjects;
            })
            return promise;
        },

        getBoxSummary: function(gameID) {
            var gameBoxScoreSummary = "http://stats.nba.com/stats/boxscoresummaryv2"
            var requiredParams = {
                "GameID":gameID,
                "callback": "JSON_CALLBACK"
            }
            var promise = $http.jsonp(gameBoxScoreSummary, {"params": requiredParams}).then(function(summ) {
                var headers = summ.data.resultSets[0].headers;
                var boxscore = summ.data.resultSets[0].rowSet;
                var boxscoreObjects = _.map(formatAPIResults.generateListOfObjects(headers, boxscore), function(obj) {
                    // console.log("object", obj)
                    obj["DATE"] = formatAPIResults.timeStamp(obj.GAME_DATE_EST)
                    var homeTeam = getterService.getTeam(obj.HOME_TEAM_ID);
                    var awayTeam = getterService.getTeam(obj.VISITOR_TEAM_ID);
                    obj["HOME_TEAM_NAME"] = homeTeam.teamName;
                    obj["VISITOR_TEAM_NAME"] = awayTeam.teamName;
                    obj["HOME_TEAM_ABBREV"] = homeTeam.abbrev;
                    obj["VISITOR_TEAM_ABBREV"] = awayTeam.abbrev;
                    return obj;
                });
                return boxscoreObjects;
            })
            return promise
        },

        getBoxAndStats: function(gameID,startRange,endRange, summary) {
            if (typeof(startRange)==='undefined') startRange = 0;
            if (typeof(endRange)==='undefined') endRange = 55800; 
            var gameBoxScoreUrl = "http://stats.nba.com/stats/boxscoretraditionalv2"
            var requiredParams = {
                "GameID":gameID,
                "StartPeriod":"1",
                "EndPeriod":"10",
                "StartRange":startRange,
                "EndRange":endRange,
                "RangeType":"2",
                "callback": "JSON_CALLBACK"
            }

            var promise = $http.jsonp(gameBoxScoreUrl,{ "params": requiredParams}).then(function(response) {
                var boxscoreObjects = summary
                
                // console.log('responseData', response.data.resultSets[1]);
                if (summary) {
                    if (boxscoreObjects[0].HOME_TEAM_ID == response.data.resultSets[1].rowSet[0][1]) {
                        boxscoreObjects[0]["HOME_TEAM_SCORE"] = response.data.resultSets[1].rowSet[0][23]
                        boxscoreObjects[0]["VISITOR_TEAM_SCORE"] = response.data.resultSets[1].rowSet[1][23]
                    }
                    else {
                        boxscoreObjects[0]["HOME_TEAM_SCORE"] = response.data.resultSets[1].rowSet[1][23]
                        boxscoreObjects[0]["VISITOR_TEAM_SCORE"] = response.data.resultSets[1].rowSet[0][23]
                    }
                }
                
                var playerHeaders = response.data.resultSets[0].headers;
                var players = response.data.resultSets[0].rowSet;
                var playerObjects = formatAPIResults.addNameKeys(formatAPIResults.generateListOfObjects(playerHeaders, players));
                // console.log("playerObjects", playerObjects);

                    
                
                return [boxscoreObjects, playerObjects];
                
            })
            return promise;
        },

        getPlayVideoUrl: function(play) {
            return "http://stats.nba.com/cvp.html?GameID=" +
                play.GAME_ID + "&GameEventID=" + play.EVENTNUM;
        }        
       
    };
    return getterService;
});

nbaLineupApp.controller('teamController', function ($scope, $rootScope, nbaAPI, $modal, $routeParams, teamData) {
    scope = $scope;

    // clear all outward facing variables
    $scope.clear = function() {
        
    };

    $scope.parseSharedUrl = function() {
        var query = location.search.substr(1);
        if (query) {
          var result = {};
          query.split("&").forEach(function(part) {
            var item = part.split("=");
            if (result[item[0]]) {
                result[item[0]] = [result[item[0]], decodeURIComponent(item[1])]
            }
            else result[item[0]] = decodeURIComponent(item[1]);
          });
          $scope.parsedSharedUrl = true;
          $scope.selectedSeason = result.season;
          $scope.selectedSeasonType = result.seasonType;
          $scope.teamOne.selected = _.findWhere($scope.teams, {id: parseInt(result.teamOne)});
          $scope.teamTwo.selected = _.findWhere($scope.teams, {id: parseInt(result.teamTwo)});
          
        }
    }

    
    //initialize
    $scope.clear();
    $scope.teams = nbaAPI.getAllTeams();
    $scope.searchTeams = $scope.teams;
    $scope.teamOne = {};
    $scope.teamTwo = {};
    $scope.selectedSeason = "2016-17";
    $scope.selectedSeasonType = "Regular Season";
    $scope.seasons = ["2014-15", "2015-16", "2016-17"];
    $scope.seasonTypes = ["Regular Season", "Playoffs"];
    $scope.parseSharedUrl();

    $scope.$on('ready', function() {
        $scope.childReady = true;
    })

    $scope.getShareableLink = function() {
        var params = {
            'teamOne' : $scope.teamOne.selected.id,
            'teamTwo' : $scope.teamTwo.selected.id,
            'season' : $scope.selectedSeason,
            'seasonType' : $scope.selectedSeasonType
        }
        var baseUrl = window.location.origin + window.location.pathname + "?";
        var paramStrings = [];
        for (var param in params) {
            if (typeof params[param] != "object")
                paramStrings.push(encodeURIComponent(param) + "=" + encodeURIComponent(params[param]));
            else {
                for (var listElement in params[param])
                    if (params[param][listElement])
                        paramStrings.push(encodeURIComponent(param) + "=" + encodeURIComponent(listElement));
            }
        }
        var fullParamString = paramStrings.join("&");
        
        var urlString = baseUrl + fullParamString;
        window.prompt("Copy to clipboard: Ctrl+C, Enter", urlString);
        
    }
    
    $scope.refreshTeams = function(teamSearch) {
        if (teamSearch) {
            teamSearch = teamSearch.toLowerCase();
             $scope.searchTeams = _.filter($scope.teams, function(teamObject) {
                return (teamObject.teamName.toLowerCase().indexOf(teamSearch) > -1 ||
                       teamObject.abbrev.toLowerCase().indexOf(teamSearch) > -1 )
            })
        }
        else $scope.searchTeams = $scope.teams;
       
    };

    $scope.$watch('teamOne.selected', function(val) {
        if (val) {
            $scope.teamOneInit = false;
            $scope.searchTeams = $scope.teams;
            teamData.addTeamId(0, val.id);
        }
    })

     $scope.$watch('teamTwo.selected', function(val) {
        if (val) {
            $scope.teamTwoInit = false;
            $scope.searchTeams = $scope.teams;
            teamData.addTeamId(1, val.id);
            if ($scope.childReady && $scope.parsedSharedUrl)
                $rootScope.$broadcast('explore')
        }
    })

   
   $scope.getRoster = function(teamID, callback) {
        nbaAPI.getRoster(teamID, $scope.selectedSeason, $scope.selectedSeasonType).then(function(result) {
             callback(result);
        })
    };
});

nbaLineupApp.controller('lineupController', function ($scope, nbaAPI, $modal, $routeParams, teamData, gameStateMachine, lineupStats) {
    scope_lineup = $scope;
    $scope.teamData = teamData;
    $scope.teamOneLineups = [];
    $scope.teamTwoLineups = [];
    $scope.selectedLineups = {};
    $scope.gameState = [];
    $scope.playByPlays = {};
    $scope.lineupHash = {};
    $scope.boxScores = {};
    $scope.gameIDs = [];

   


   
    //top 3 most played matchups
    var processLineups = function(gameID) {
        // console.log('processing');
        var totalPeriods = $scope.boxScores[gameID].LIVE_PERIOD;
        var periods = [];
        for (var i = 1; i < totalPeriods + 1; i++) { 
            periods[i-1] = i;
        }
        $scope.playByPlays[gameID].state = _.mapObject($scope.playByPlays[gameID].state, function(lineupInfo, hash) {
            // console.log('lineupInfo', lineupInfo);
            return {
                    "plays": _.sortBy(lineupInfo.plays, function(play) { return play.PERIOD; }),
                    "plays_by_period": _.map(periods, function(period) {
                        var playsInPeriod = _.filter(lineupInfo.plays, function(play){ return play.PERIOD == period});
                        return playsInPeriod;
                    }),
                    "time": lineupStats.getTimePlayed(lineupInfo.plays),
                    "time_by_period": _.map(periods, function(period) {
                        var playsInPeriod = _.filter(lineupInfo.plays, function(play){ return play.PERIOD == period});
                        var timeInPeriod = lineupStats.getTimePlayed(playsInPeriod);
                        return timeInPeriod;
                    }),
                    "shots": lineupStats.getPoints(lineupInfo.plays),
                    "shots_by_period": _.map(periods, function(period) {
                        var playsInPeriod = _.filter(lineupInfo.plays, function(play){ return play.PERIOD == period});
                        return lineupStats.getPoints(playsInPeriod);
                    }),
                    "turnovers": lineupStats.getTO(lineupInfo.plays),
                    "turnovers_by_period":  _.map(periods, function(period) {
                        var playsInPeriod = _.filter(lineupInfo.plays, function(play){ return play.PERIOD == period});
                        return lineupStats.getTO(playsInPeriod);
                    })
                }
        })

    }
    
    $scope.$watchCollection('gameIDs', function(newVal) {
        if (newVal) {
            // console.log('newVal', newVal);

            getGameState(newVal);
        }
    })


    $scope.explore = function() {
        $scope.gameIDs = [];
        $scope.totalPeriods = 0;
        $scope.completedPeriods = 0;
        $scope.loaded = false;
        $scope.loading = true;
        // console.log('explore', teamData.teams[0].id, teamData.teams[0])
        nbaAPI.getGamesForTeam(teamData.teams[0].id, $scope.selectedSeason, $scope.selectedSeasonType).then(function(result) {
            var teamOneGameIDs = _.pluck(result, "Game_ID");
            nbaAPI.getGamesForTeam(teamData.teams[1].id, $scope.selectedSeason, $scope.selectedSeasonType).then(function(result2) {
                var teamTwoGameIDs = _.pluck(result2, "Game_ID");
                $scope.gameIDs = _.sortBy(_.intersection(teamOneGameIDs, teamTwoGameIDs), function(gameID) {return gameID});
            })
        });
    }

    $scope.$watch('completedPeriods', function(newVal) {
        if (newVal) {
            if (newVal == $scope.totalPeriods) {
                $scope.loaded = true;
                $scope.loading = false;
            }
                
        }
    })

    $scope.getDisplayLineups = function(gameID) {
        var mostPlayedPill = angular.element( document.querySelector( '#most-played-pill-' + gameID.toString() ) );
        var homebestPill = angular.element( document.querySelector( '#home-best-pill-' + gameID.toString() ) );
        var visitorbestPill = angular.element( document.querySelector( '#visitor-best-pill-' + gameID.toString() ) );
        var customPill = angular.element( document.querySelector( '#custom-pill-' + gameID.toString() ) );
        
        if (mostPlayedPill.hasClass('active')) $scope.mostPlayedLineups(gameID);
        else if (homebestPill.hasClass('active')) $scope.bestLineups(gameID, 'home');    
        else if (visitorbestPill.hasClass('active')) $scope.bestLineups(gameID, 'visitor');
        else if (customPill.hasClass('active')) $scope.getCustom(gameID);
    }

    $scope.mostPlayedLineups = function(gameID, period) {
        $scope.selectedPeriod = period;
        // console.log('gameID, period', gameID, period);
        if (!$scope.processedGames) {
            _.each($scope.gameIDs, function(gameID) {
                    processLineups(gameID);
                });
            $scope.processedGames = true;
        }
        
        if (!period) {
            $scope.displayLineups = _.chain($scope.playByPlays[gameID].state)
                                  .pairs()
                                  .sortBy(function(hashLineupPair) {
                                    var lineup = hashLineupPair[1]
                                    return -(60*parseInt(lineup['time'].split(":")[0]) + parseInt(lineup['time'].split(":")[1]))
                                  }).value().slice(0,3);
        }
            
        else {
            $scope.displayLineups = _.chain($scope.playByPlays[gameID].state)
                                  .pairs()
                                  .sortBy(function(hashLineupPair) {
                                    var lineup = hashLineupPair[1]
                                    return -(60*parseInt(lineup['time_by_period'][period-1].split(":")[0]) + parseInt(lineup['time_by_period'][period-1].split(":")[1]))
                                  }).value().slice(0,3);
            
        }
    }

    $scope.bestLineups = function(gameID, team, period) {
        $scope.hideCustomStats = true;
        $scope.selectedPeriod = period;
        if (!period) {
            $scope.displayLineups = _.chain($scope.playByPlays[gameID].state)
                                  .pairs()
                                  .sortBy(function(hashLineupPair) {
                                    var lineup = hashLineupPair[1];
                                    if (lineup['time'] == "0:00") {
                                        return Infinity
                                    }
                                    var homeScore = lineup['shots']['home'].score;
                                    var visitorScore = lineup['shots']['visitor'].score;
                                    if (team == "home") {
                                        return -(homeScore - visitorScore);
                                    }
                                    else {
                                        return -(visitorScore - homeScore)
                                    }
                                  }).value().slice(0,3);
        }
        else {
             $scope.displayLineups = _.chain($scope.playByPlays[gameID].state)
                                  .pairs()
                                  .sortBy(function(hashLineupPair) {
                                    var lineup = hashLineupPair[1];
                                    if (lineup['time_by_period'][period-1] == "0:00") {
                                        return Infinity
                                    }
                                    var homeScore = lineup['shots_by_period'][period-1]['home'].score;
                                    var visitorScore = lineup['shots_by_period'][period-1]['visitor'].score;
                                    if (team == "home") {
                                        return -(homeScore - visitorScore);
                                    }
                                    else {
                                        return -(visitorScore - homeScore)
                                    }
                                  }).value().slice(0,3);
        }
    }

    $scope.getCustom = function(gameID) {
        $scope.displayCustom = {};
        var hash = getHashForLineup(_.union($scope.homeTeamCustom, $scope.visitorTeamCustom));
        // console.log('custom', gameID, hash);
        $scope.displayCustom = $scope.playByPlays[gameID].state[hash];
        $scope.hideCustomStats = false;
    }

    $scope.getNumber = function(num) {
        return new Array(num);   
    }

    $scope.customLineups = function(gameID) {
        $scope.hideCustomStats = true;
        if ($scope.boxScores[gameID].HOME_TEAM_ID == teamData.teams[0].id) {
            $scope.homeTeamCustomPlayers = $scope.playByPlays[gameID].players[0];
            $scope.visitorTeamCustomPlayers = $scope.playByPlays[gameID].players[1]; 
        }
        else {
            $scope.visitorTeamCustomPlayers = $scope.playByPlays[gameID].players[0];
            $scope.homeTeamCustomPlayers = $scope.playByPlays[gameID].players[1];
        }
        
        $scope.homeTeamCustom = $scope.homeTeamCustomPlayers.slice(0,5);
        $scope.visitorTeamCustom = $scope.visitorTeamCustomPlayers.slice(0,5);
    }

    var getPlaysFromGame = function(gameID) {
        var teamOneSelectedIDs = _.pluck($scope.selectedLineups.teamOne, "PLAYER_ID")
        var teamTwoSelectedIDs = _.pluck($scope.selectedLineups.teamTwo, "PLAYER_ID")

        return _.filter($scope.playByPlays[gameID], function(play) {
            var teamOnePlayIDs = _.pluck(play.state[0], "PLAYER_ID")
            var teamTwoPlayIDs = _.pluck(play.state[1], "PLAYER_ID")
            // console.log("team1, team2", teamOnePlayIDs,teamTwoPlayIDs)
            return (_.difference(teamOnePlayIDs,teamOneSelectedIDs).length == 0 &&
                    _.difference(teamTwoPlayIDs,teamTwoSelectedIDs).length == 0 )
        })
    }

    var getHashForLineup = function(lineup) {
        var initHash = 0;
        _.each(lineup, function(player) {
            initHash += player.PLAYER_NAME.hashCode()
        })
        return initHash;
    }

    var getPlayByPlay = function(gameID, period, startState, totalPeriods, players) {
        var teamOneState = startState.teamOneState;
        var teamTwoState = startState.teamTwoState;
        nbaAPI.getGamePlayByPlay(gameID, $scope.selectedSeason, $scope.selectedSeasonType, period, period).then(function(result) {
            // console.log("result of new get", result, result.length);
            
            _.each(result, function(play) {
                //beginning of period
                    
                    teamOneState = gameStateMachine.evaluateState(play, teamOneState, players);
                    teamTwoState = gameStateMachine.evaluateState(play, teamTwoState, players);
                    play["state"] = [teamOneState,teamTwoState];

                    play["url"] = nbaAPI.getPlayVideoUrl(play);
                    var stateHash = getHashForLineup(_.union(teamOneState, teamTwoState));
                    if (!$scope.lineupHash[stateHash]) $scope.lineupHash[stateHash] = [teamOneState,teamTwoState];
                    if (!$scope.playByPlays[gameID]['state'][stateHash]) {
                        $scope.playByPlays[gameID]['state'][stateHash] = {'plays':[play]}
                    }
                    else {
                        $scope.playByPlays[gameID]['state'][stateHash].plays.push(play);
                    }
                    return play;
                })
            $scope.completedPeriods++;
        })
    }

    var getGameState = function(games) {
        // console.log('getting called')
        $scope.processedGames = false;
        _.each(games, function(gameID) {
            $scope.playByPlays[gameID] = {'state':{}, 'players': []};
            // console.log('gameID', gameID)
            nbaAPI.getBoxSummary(gameID).then(function(summary) {
                nbaAPI.getBoxAndStats(gameID, undefined, undefined, summary).then(function(result) {
                    // console.log('result', result)
                    var players = result[1];
                    $scope.boxScores[gameID] = result[0][0];
                    $scope.playByPlays[gameID]['players'][0] = _.filter(players, function(player) {return player.TEAM_ID == teamData.teams[0].id})
                    $scope.playByPlays[gameID]['players'][1] = _.filter(players, function(player) {return player.TEAM_ID == teamData.teams[1].id})
                    var totalPeriods = $scope.boxScores[gameID].LIVE_PERIOD;
                    $scope.totalPeriods += totalPeriods; 
                    var periods = [];
                    for (var i = 0; i < totalPeriods; i++) { 
                        periods[i] = i;
                    }
                    _.each(periods, function(period) {
                        // console.log("PERIOD", period);
                        var startRange = (12*60*10)*period + 50;
                        var endRange = startRange + 300;
                        nbaAPI.getBoxAndStats(gameID, startRange, endRange, undefined).then(function(result) {

                            
                            var periodStartState = {'teamOneState': gameStateMachine.getStartState(teamData.teams[0].id, result[1]),
                                                   'teamTwoState': gameStateMachine.getStartState(teamData.teams[1].id, result[1])
                                                    }
                            // console.log("result in getBox", result, gameID, startRange, endRange, periodStartState)
                            getPlayByPlay(gameID, period+1, periodStartState, totalPeriods, players);
                        })
                    })
                    
                })
            }) 
            
        })
    }

    $scope.showVideo = function(play) {
        $scope.openModal(play);
    }

    $scope.openModal = function (play) {

        var modalInstance = $modal.open({
          windowClass: "video-modal-class",
          animation: true,
          templateUrl: 'myModalContent.html',
          controller: 'ModalInstanceCtrl',
          size:'lg',
          resolve: {
            play: function () {
                return play;
            }
          }
        })
    };

    $scope.$on('explore', function(event, args) {
        // console.log('explore now');
        $scope.explore();
    });

    $scope.$emit('ready');

});

nbaLineupApp.controller('ModalInstanceCtrl', function ($scope, $modalInstance, $sce, play) {
  $scope.iFrameUrl = play.url;
  $scope.trustAsResourceUrl = $sce.trustAsResourceUrl;
  $scope.play = play;

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
});



    