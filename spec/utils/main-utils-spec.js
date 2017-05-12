'use strict'
const mongoose = require('mongoose')
const mockgoose = require('mockgoose')
const Trend = require('../../src/models/trend')
const rewire = require('rewire')
const mainUtils = rewire('../../src/utils/main-utils')

mongoose.Promise = global.Promise

describe('Main utils', () => {
  beforeAll(done => {
    // Wrap mongoose with mockgoose
    mockgoose(mongoose).then(() => {
      mongoose.connect('mongodb://example.com/testdb', (err) => {
        done(err)
      })
    })
  })

  afterAll(done => {
    mockgoose.reset(() => {
      mongoose.connection.close()
      done()
    })
  })

  afterEach(done => {
    // Clear all collections from mockgoose
    mockgoose.reset(() => {
      done()
    })
  })

  it('Should remove all old trends from the database with removeOldTrends', done => {
    let mockTrends = [
      getMockTrend(),
      getMockTrend(),
      getMockTrend()
    ]

    mockTrends[0].name = '#trend1'
    mockTrends[1].name = '#trend2'
    mockTrends[2].name = '#trend3'

    storeMockTrends(mockTrends).then(() => {
      // Remove #trend3 from the database
      mainUtils.removeOldTrends(['#trend1', '#trend2']).then(() => {
        getAllTrends().then(trends => {
          // #trend3 should no longer exist
          expect(trends.length).toEqual(2)
          expect(trends[0].name).toEqual('#trend1')
          expect(trends[1].name).toEqual('#trend2')
          done()
        })
      })
    })
  })

  it('Should add a new trend with createTrend', done => {
    let trend = getMockTrend()

    mainUtils.createNewTrend(trend).then(() => {
      getAllTrends().then(trends => {
        expect(trends.length).toEqual(1)
        done()
      })
    })
  })

  it('Should update an existing trend with updateExistingTrend', done => {
    let existingTrendData = getMockTrend()
    let currentTrendData = getMockTrend()

    currentTrendData.rank = 3
    currentTrendData.articles = [
      {
        title: 'new articles',
        description: 'A new Article',
        source: 'http://cnn.com',
        link: 'http://cnn.com/article',
        timestamp: 1494573005,
        media: 'http://cnn.com/image.jpg'
      }
    ]
    currentTrendData.tweets = [
      { embed_id: '111111' },
      { embed_id: '222222' }
    ]
    currentTrendData.sentiment_score = -2
    currentTrendData.tweets_analyzed = 5

    let trendModel = Trend(existingTrendData)

    trendModel.save().then(() => {
      mainUtils.updateExistingTrend(existingTrendData, currentTrendData).then(() => {
        Trend.findOne({}).then(doc => {
          // Rank should be copied from currentTrendData
          expect(doc.rank).toEqual(currentTrendData.rank)

          // Articles should be replaced
          doc.articles.forEach((article, i) => {
            expect(article).toEqual(jasmine.objectContaining(currentTrendData.articles[i]))
          })

          // Tweets should be replaced
          doc.tweets.forEach((tweet, i) => {
            expect(tweet).toEqual(jasmine.objectContaining(currentTrendData.tweets[i]))
          })

         // Tweets analyzed should be summed up
          let totalTweetsAnalyzed = currentTrendData.tweets_analyzed + existingTrendData.tweets_analyzed
          expect(doc.tweets_analyzed).toEqual(totalTweetsAnalyzed)

          // Sentiment should be properly averaged weighting for tweets_analyzed
          let sentimentAvg = (currentTrendData.sentiment_score * currentTrendData.tweets_analyzed +
            existingTrendData.sentiment_score * existingTrendData.tweets_analyzed) / totalTweetsAnalyzed

          expect(doc.sentiment_score).toEqual(sentimentAvg)

          done()
        })
      })
    })
  })

  it('Should call createNewTrend when processTrend is called with a new Trend', done => {
    spyOn(mainUtils, 'createNewTrend').and.returnValue({then: () => {
      expect(mainUtils.createNewTrend).toHaveBeenCalled()
      done()
    }})

    mainUtils.processTrend(getMockTrend(), [], [])
  })

  it('Should call updateExistingTrend when processTrend is called with an existing Trend', done => {
    let trend = getMockTrend()
    let trendModel = new Trend(trend)

    spyOn(mainUtils, 'updateExistingTrend').and.returnValue({then: () => {
      expect(mainUtils.updateExistingTrend).toHaveBeenCalled()

      done()
    }})

    trendModel.save().then(() => {
      mainUtils.processTrend(trend, [], [])
    })
  })
})

/**
 * Stores all mock trends specified in trends to the database. Returns a
 * promise
 *
 * @param {Array} trends Array of trends
 */
function storeMockTrends (mockTrends, cb) {
  return new Promise((resolve, reject) => {
    Trend.collection.insert(mockTrends).then(docs => {
      resolve()
    }).catch(reject)
  })
}

/**
 * Gets all current trends from the database. Returns a promise.
 *
 * @param {Function} cb Callback to be called with the array of trends
 * @return {Promise} Promise resolved after trends are retreived
 */
function getAllTrends (cb) {
  return new Promise((resolve, reject) => {
    Trend.find({}).then((docs) => {
      resolve(docs)
    }).catch(reject)
  })
}

/**
 * Returns a mock trend object for testing.
 *
 * @return {Object} a mock trend
 */
function getMockTrend () {
  return {
    name: '#trend',
    rank: 2,
    tweets_analyzed: 100,
    sentiment_score: 3,
    sentiment_description: 'Positive',
    locations: ['US', 'CA'],
    tweet_volume: 12345,
    tweets: [
      { embed_id: '123456' },
      { embed_id: '123457' }
    ],
    articles: [
      {
        title: 'SomeArticleTitle',
        description: 'An Article',
        source: 'http://cnn.com',
        link: 'http://cnn.com/article',
        timestamp: 1494573005,
        media: 'http://cnn.com/image.jpg'
      }
    ]
  }
}
