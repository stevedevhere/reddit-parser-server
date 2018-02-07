const express = require('express');
const app = express();
const graphqlHTTP = require('express-graphql');
const cors = require('cors');
const bodyParser = require('body-parser');
const { buildSchema } = require('graphql');
const fetch = require('node-fetch');
const entities = require('html-entities').XmlEntities;
const translate = require('google-translate-api');

function handleTranslate(text, lang) {
  return Promise.all([
    translate(text, {from: 'en', to: lang}).then(res => {
      return { result: res.text };
    }).then(res => res).catch(err => {
      return text;
    })
  ]).then(result => result);
}

function translator(data, lang = "") {
  const result = data.map(item => {
    const newItem = {};
    for (let key in item) {
      if (key !== 'id' && key !== 'link') {
        handleTranslate(item[key], lang);
      } else newItem[key] = item[key];
    }
    return newItem;
  });
  return result;
};

const getPostBySchema = async (lang, item) => {

  const title = await translate(item.data.title, { from: 'en', to: lang }).then(res => res.text);
  const description = await translate(entities.decode(item.data.selftext_html), { from: 'en', to: lang }).then(res => res.text);
  return ({
    id: item.data.name,
    title,
    description,
    link: item.data.permalink,
  });
}

var schema = buildSchema(`
  type Post {
    id: ID
    title: String
    description: String
    excerpt: String
    link: String
  }

  type Query {
    posts(title: String, after: String, before: String, lang: String): [Post]!
  }
`);

var root = {
  posts: (query) => {
    const baseURL = 'https://www.reddit.com/r/javascript';
    if (query.title) {
      return fetch(`${baseURL}/search.json?limit=14&q=${query.title || ''}&after=${query.after || ''}&before=${query.before || ''}&restrict_sr=on`)
      .then(r => r.json()).then(r => r.data.children.map(getPostBySchema.bind(null, query.lang)));
    }
    
    return fetch(`${baseURL}.json?limit=14&after=${query.after || ''}&before=${query.before || ''}`)
      .then(r => r.json()).then(r => r.data.children.map(getPostBySchema.bind(null, query.lang)));
  }
};

app.use('/graphql', cors(), bodyParser.json(), graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));


app.listen(8081, () => console.log('Listening... '));