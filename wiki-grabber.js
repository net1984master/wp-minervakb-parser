let request = require('request')
let querystring = require('querystring')
const jsdom = require('jsdom')
const {JSDOM} = jsdom

/**
 * Функционал для забора данных с сайта WP (плагин MinervaKB)
 */
class WikiGrabber {
   constructor(params) {
    Object.assign(this.wikiParams, params)
  }
  wikiParams = {
    wikiUrl: undefined,
    wikiLogin: undefined,
    wikiPassword: undefined,
    list_selector: 'div .mkb-widget-content-tree__list',
    article_selector: '.mkb-article-text',
    is_custom_login: undefined,
    mtnc_login_check: undefined,
    cookie: undefined,
  }
  _parseLoginParams(html) {
    return new Promise((resolve, reject) => {
      let mtncEx = /(?<=name=\Wmtnc_login_check\W\s*value=\W)\w+(?=\W)/i
      let isEx = /(?<=name=\Wis_custom_login\W\s*value=\W)\w+(?=\W)/i
      let mtnsVal = html.match(mtncEx);
      let isVal = html.match(isEx);
      if (mtnsVal !== null) {
        this.wikiParams.mtnc_login_check = mtnsVal[0];
      } else {
        reject()
      }
      if (isVal !== null) {
        this.wikiParams.is_custom_login = isVal[0];
      } else {
        reject()
      }
      resolve();
    })
  }
  _prepareWikiLoginParams() {
    const options = {
      url: this.wikiParams.wikiUrl,
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'Accept-Charset': 'utf-8',
      }
    }
    return new Promise((resolve, reject) => {
      request(options, (err, res, body) => {
        if (!err && res.statusCode == 200) {
          resolve(this._parseLoginParams(body))
        } else {
          reject(err)
        }
      })
    })
  }
  _prepareWikiCookie() {
    return new Promise((resolve, reject) => {
      const postData = querystring.stringify({
        log: this.wikiParams.wikiLogin,
        pwd: this.wikiParams.wikiPassword,
        is_custom_login: this.wikiParams.is_custom_login,
        mtnc_login_check: this.wikiParams.mtnc_login_check,
      });
      const options = {
        url: this.wikiParams.wikiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Accept-Charset': 'utf-8',
        },
        body: postData
      }
      request(options, (err, res, body) => {
        if (!err) {
          this.wikiParams.cookie = res.headers['set-cookie']
          resolve()
        } else {
          reject(err)
        }
      })
    })
  }
  _prepareArticleHtml(html){
    const dom = new JSDOM(html)
    let article = dom.window.document.querySelector(this.wikiParams.article_selector)
    article.querySelectorAll('img').forEach(img => {
      if (+img.width > 100)
      {
        img.parentNode.style=''
        let newImg =`<img class="${img.classList.value}" src="${img.src}'" alt="${img.alt}"  width="100%" height="auto">`
        img.outerHTML = newImg
      }
    })
    return  article.outerHTML
  }
  _generateTree(nd, obj) {
    if (nd.tagName === 'UL') {
      nd.childNodes.forEach(value => {
        if (value.tagName == 'LI') {
          let newObj = {name: '', child: [],level:obj.level+1,id:value.dataset.id,parent: obj.id}
          obj.child.push(newObj)
          this._generateTree(value, newObj)
        }
      })
    } else if (nd.tagName === 'LI') {
      let text = nd.textContent.trim().split('\n')[0].trim();
      obj.name = text;
    }
    if (nd.tagName === 'A') {
      obj.href = nd.getAttribute("href");
    } else if (nd.tagName !== 'UL') {
      nd.childNodes.forEach(value => {
        if (value.tagName !== undefined) {
          this._generateTree(value, obj)
        }
      })
    }
  }
  _getTree(html) {
    const dom = new JSDOM(html)
    let nodes = dom.window.document.querySelector(this.wikiParams.list_selector)
    let obj = {name: 'start', child: [], level: -1, id: -1}
    this._generateTree(nodes, obj)
    return obj;
  }
  async _getWikiPage(url) {
    return new Promise((resolve, reject) => {
      const options = {
        url: url,
        method: 'GET',
        headers: {
          'Accept': 'text/html',
          'Accept-Charset': 'utf-8',
          'Cookie': this.wikiParams.cookie
        }
      }
      request(options, (err, res, body) => {
        if (!err && res.statusCode == 200) {
          resolve(body);
        } else {
          reject(err)
        }
      })
    })
  }
  async getWikiList() {
    try {
      await this._prepareWikiLoginParams()
      await this._prepareWikiCookie()
      let html = await this._getWikiPage(this.wikiParams.wikiUrl)
      let listObject = await this._getTree(html)
      return listObject
    } catch (e) {
      console.log(e)
      return
    }
  }
  async getWikiArticle(url) {
    try {
      await this._prepareWikiLoginParams()
      await this._prepareWikiCookie()
      let html = await this._getWikiPage(url)
      let articleHtml = await this._prepareArticleHtml(html)
      return articleHtml
    }catch (e) {
      console.log(e)
      return
    }
  }
}

module.exports = {WikiGrabber}
