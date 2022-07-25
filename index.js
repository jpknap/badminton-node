var express = require('express');
var axios = require('axios')
var moment = require('moment')
const { writeFile, readFileSync } = require('fs');
var bodyParser = require('body-parser')

var app = express();

 
// create application/json parser
var jsonParser = bodyParser.json()
 
// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false })

app.get('/', async function (req, res) {
  res.send('Que Sucede');
});

app.get('/users', async function (req, res) {
  const users = await getUsers();

  const rivals = users.map((user) => {
    const victories = getVictoriesUser(user.id);
    const losses = getLossesUser(user.id);
    return {
      name: user.name,
      id: user.id,
      lastname: user.lastname,
      victories: victories,
      losses: losses,
      image: '',
    }
  });
  res.send(rivals)
});

app.get('/matchs/history', async function (req, res) {
  const matchs = getMatchs();
  const token = req.query.token;
  let userLogin = getUserByToken(token);

  const matchsHistory = matchs.filter((match) => {
    return (match.userChallenging == userLogin.id || match.userChallenged  == userLogin.id)
    &&
    match.finish_at != ""
  })
  const matchsHistorySort = matchs.sort((match, match2) => {
    var date= moment(match.finish_at, 'DD/MM/yyyy HH:mm' );
    var date2= moment(match2.finish_at, 'DD/MM/yyyy HH:mm');

    if (date.diff(date2, 'minutes') < 0) {
      return 1;
    }
    if (date.diff(date2, 'minutes') > 0) {
      return -1;
    }
    // a must be equal to b
    return 0;
  })
  res.send(matchsHistorySort.map((item) => {
    item.id = parseInt(item.id)
    item.userChallenging = getUserById(item.userChallenging)
    item.userChallenged = getUserById(item.userChallenged)
    return item;
  }));
});

app.get('/matchs/pending', async function (req, res) {
  const matchs = getMatchs();
  const token = req.query.token;
  let userLogin = getUserByToken(token);
  
  const matchPending = matchs.filter((match) => {
    return (match.userChallenging == userLogin.id || match.userChallenged  == userLogin.id)
    &&
    match.finish_at == ""
  })

  res.send(matchPending.map((item) => {
    item.id = parseInt(item.id)
    item.userChallenging = getUserById(item.userChallenging)
    item.userChallenged = getUserById(item.userChallenged)
    return item;
  }));
});

app.post('/login',jsonParser, function (req, res) {
  const email = req.body.email;
  const password = req.body.password
  const users = getUsers();
  let userLogin = null;
  users.forEach(user => {
    if ( user.email.toUpperCase().trim() == email.toUpperCase().trim() && password == user.password) {
      userLogin = user
    }
  });
  res.send(userLogin);

});

app.post('/login-token',jsonParser, function (req, res) {
  const token = req.body.token;
  let userLogin = getUserByToken(token);
  res.send(userLogin);

});

app.get('/match/create', function (req, res) {
  const matchs = getMatchs();
  
  const userChallenging = req.query.userChallenging
  const userChallenged = req.query.userChallenged

  const newMatch = {};
  newMatch.id = getLastId(matchs);
  newMatch.userChallenging = userChallenging;
  newMatch.userChallenged = userChallenged;
  newMatch.created_at = moment().format('DD/MM/yyyy HH:mm');  
  newMatch.finish_at = "";
  newMatch.pointsChallenging = "";
  newMatch.pointsChallenged = "";
  newMatch.type = 1;

  const newMatchs = [...matchs, newMatch];
  saveMatchFile(newMatchs);

  res.send(newMatchs);

});

app.post('/match/result', jsonParser, function (req, res) {
  const matchId = req.body.id;
  const pointsChallenging = req.body.pointsChallenging;
  const pointsChallenged = req.body.pointsChallenged;

  const matches = getMatchs();
  const updatedMatch = matches.map((item) => {
    if(item.id == matchId){
      item.pointsChallenging = pointsChallenging;
      item.pointsChallenged = pointsChallenged;
      item.finish_at = moment().format('DD/MM/yyyy HH:mm');  //  07-06-2016 06:38:34

    }
    return item;
  });

  saveMatchFile(updatedMatch)

  res.send(updatedMatch);

});

app.get('/update-users', async function (req, res) {
  let users = {};
  await axios({
    method: 'get',
    url: "https://sheet.best/api/sheets/c24c5a78-e379-45ac-a951-319044a82bbe",
  })
    .then(function (response) {
      users = response.data
      saveUsersFile(users)
    });

  res.send(users);
});

app.get('/update-matchs', async function (req, res) {
  let matchs = {};
  await axios({
    method: 'get',
    url: "https://sheet.best/api/sheets/7cb17e95-863f-4b9c-93bb-951112c1bd12",
  })
    .then(function (response) {
      matchs = response.data
      saveMatchFile(matchs)
    });

  res.send(matchs);
});


const getUsers = () => {
  const path = './users.json';

  const users = JSON.parse(readFileSync(path, 'utf8'));
  return users.map(user => {
    user.id = parseInt(user.id);
    return user;
  })
}
const getUserByToken = (token) => {
  const users = getUsers();
  let userToken = null;
  users.forEach(user => {
    if (user.token == token) {
      userToken = user
    }
  });
  return userToken;

}
const getMatchs = () => {
  const path = './matchs.json';

  const matchs = JSON.parse(readFileSync(path, 'utf8'));
  return matchs.map ((match) => {
    match.pointsChallenging = parseInt( match.pointsChallenging )
    match.pointsChallenged = parseInt(match.pointsChallenged )
    return match
  });
}

const getVictoriesUser = (userId) => {
  const matchsPlayed = getMatchPlayedUser(userId)
  let  victories = 0;
  matchsPlayed.forEach ((match) => {
    if (match.userChallenging == userId && match.pointsChallenging > match.pointsChallenged){
      victories++;
    }
    else  
    if (match.userChallenged == userId && match.pointsChallenged > match.pointsChallenging){
      victories++;
    }
  });

  return victories;
}
const getLossesUser = (userId) => {
  const matchsPlayed = getMatchPlayedUser(userId)
  let  losses = 0;
  matchsPlayed.forEach ((match) => {
    if (match.userChallenging == userId && match.pointsChallenging < match.pointsChallenged){
      losses++;
    }
    else  
    if (match.userChallenged == userId && match.pointsChallenged < match.pointsChallenging){
      losses++;
    }
  });

  return losses;
}

const getMatchPlayedUser = (userId) => {
  const matchs = getMatchs();
  const matchPlayed = matchs.filter(
    match => {
      return match.userChallenging == userId ||
             match.userChallenged  == userId ||
             match.finish_at != ""
    }
  );
  return matchPlayed;
}

const saveUsersFile = (json) => {
  const path = './users.json'
  writeFileJson(path, json)

}
const saveMatchFile = (json) => {
  const path = './matchs.json'
  writeFileJson(path, json)

}
const writeFileJson = async (path, dataJson) => {
  const parsedData = JSON.stringify(dataJson) ?? "error";
  await writeFile(path, '' + parsedData, (err) => {
    if (err) {
      console.log('Failed to write updated data to file');
      return;
    }
    console.log('Updated file successfully');
  });
}
const getLastId = (collection) => {
  let idMax = 0;
  collection.forEach((item) => {
    if (parseInt(item.id) > idMax ){
      idMax = item.id;
    }
  })
  return parseInt(idMax) +1;
}
const getUserById = (id) => {
  const users = getUsers();
  const user = users.filter((user) => id == user.id);
  return user[0];
}
const PORT = process.env.PORT || 3001;
app.listen(PORT, function () {
  console.log('Example app listening on port 3000!');
});