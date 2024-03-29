const fs = require('fs')
const path = require('path')
const gulp = require('gulp')
const customMarkdown = require('./util/gulp-plugin/customMarkdown')
const rename = require("gulp-rename")
const dirTree = require('directory-tree')
const htmlToText = require('html-to-text')
const moment = require('moment')
const jsdom = require("jsdom");

const { JSDOM } = jsdom;

const inputPath = path.resolve(__dirname, './data/blog/src/**/*.md')
const outputPath = path.resolve(__dirname, './data/blog/dist')
const outputFilesPath = path.resolve(__dirname, './data/blog/dist/**/*.html')
const blogDataPath = path.resolve(__dirname, './data/blog/blogData.json')


// transform markdown files to html
gulp.src(inputPath)
  .pipe(customMarkdown())
  .pipe(rename(path => { path.extname = '.html' }))
  .pipe(gulp.dest(outputPath))


// build blog data
const data = getBlogData()
fs.writeFile(blogDataPath, JSON.stringify(data), function (err) {
  if (err) {
    return console.log(err);
  }
});


function getBlogData() {
  return {
    blogTitle: "Terry Su 的博客",
    NewestColumnTitle: '最新博客',
    blogs: getBlogs(),
    catalog: getCatalog(),
    tags: getTags(),
  }

  function getBlogs() {
    const tree = dirTree(outputPath)
    let blogs = []
    let category = 'default'
    // get default blogs
    tree.children
      .filter(info => info.type === 'file')
      .map(fileInfo => {
        _resolveFileInfo(fileInfo, blogs, category)
      })
    // get blogs in category folder
    tree.children
      .filter(info => info.type === 'directory')
      .map(info => {
        const { name: category } = info
        info.children.map(fileInfo => {
          _resolveFileInfo(fileInfo, blogs, category)
        })
      })

    // filter blog which is null 
    blogs = blogs.filter(blog => blog != null)

    // sort by create time
    blogs = blogs.sort((a, b) => {
      return moment(a.createTime).isBefore(b.createTime)
    })

    // reformat create time
    blogs = blogs.map(blog => {
      return Object.assign(blog, {
        createTime: moment(blog.createTime).format('YYYY/MM/DD h:mm')
      })
    })
    return blogs

    function _resolveFileInfo(fileInfo, blogs, category) {
      const {
        path,
        name
      } = fileInfo
      const htmlTxt = fs.readFileSync(path, { encoding: 'utf8' })
      const resolvedPath = path.replace(__dirname, '')
      let tags = []

      // get abstract
      const abstract = `${htmlToText.fromString(htmlTxt).substring(0, 100)}...`

      // get create time
      const originPath = path.replace('/dist/', '/src/').replace('.html', '.md')
      let isError = false
      let stat
      try {
        stat = fs.statSync(originPath)
      } catch(e) {
        // console.log('warning:  ' + e)
        isError = true
      }
      // the file has no relevant markdown file
      if (isError) { stat = fs.statSync(path) }

      const { birthtime } = stat
      let createTime = birthtime

      // get tag and createTime
      const { window } = new JSDOM(htmlTxt)
      try {
        const dataDom = window.document.getElementById('ts_data')
        const data = JSON.parse(dataDom.innerHTML)
        tags = data.tags
        createTime = (data.createTime ? new Date(data.createTime) : null) || createTime
      } catch (e) {

      }

      blogs.push({
        id: generateId(name.replace('.html',''), resolvedPath),
        title: name.replace('.html',''),
        path: resolvedPath,
        abstract,
        createTime,
        tags,
        category,
        repostNotice: 'This article is original, reprint please indicate the source',
        content: null
      })

      return blogs
    }
  }

  function getCatalog() {
    const tree = dirTree(outputPath)
    return tree.children
      .filter(info => info.type === 'directory')
      .map(info => info.name)
  }

  function getTags() {
    let tags = []
    const blogs = getBlogs()
    blogs.map(blog => {
      const { tags: blogTags } = blog
      tags = tags.concat(blogTags)
    })
    // filter repeated tags
    tags = tags.filter((item, pos, arr) => {
      return arr.indexOf(item) === pos && item != ''
    })
    
    return tags
  }

  function generateId(name , path) {
    return new Buffer(path + '%^&*(' + name).toString('base64')
  }

}

