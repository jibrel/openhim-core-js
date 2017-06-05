// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import should from 'should';
import request from 'supertest';
import _ from 'lodash';
import server from '../../lib/server';
import testUtils from '../testUtils';
import { Visualizer } from '../../lib/model/visualizer';
import { auth } from '../testUtils';

describe('API Integration Tests', () =>
  describe('Visualizers REST API testing', function() {

    let visObj = {
      name: 'TestVisualizer',
      components: [{
          eventType: 'primary',
          eventName: 'OpenHIM Mediator FHIR Proxy Route',
          display: 'FHIR Server'
        }
        , {
          eventType: 'primary',
          eventName: 'echo',
          display: 'Echo'
        }
      ],
      color: {
        inactive: '#c8cacf',
        active: '#10e057',
        error: '#a84b5c',
        text: '#4a4254'
      },
      size: {
        responsive: true,
        width: 1000,
        height: 400,
        paddin: 20
      },
      time: {
        updatePeriod: 200,
        maxSpeed: 5,
        maxTimeout: 5000,
        minDisplayPeriod: 500
      },
      channels: [{
          eventType: 'channel',
          eventName: 'FHIR Proxy',
          display: 'FHIR Proxy'
        }
        , {
          eventType: 'channel',
          eventName: 'Echo',
          display: 'Echo'
        }
      ],
      mediators: [{
          mediator: 'urn:mediator:fhir-proxy',
          name: 'OpenHIM Mediator FHIR Proxy',
          display: 'OpenHIM Mediator FHIR Proxy'
        }
        , {
          mediator: 'urn:mediator:shell-script',
          name: 'OpenHIM Shell Script Mediator',
          display: 'OpenHIM Shell Script Mediator'
        }
      ]
    };

    let authDetails = {};

    before(done =>
      Visualizer.remove({}, () =>
        auth.setupTestUsers(() =>
          server.start({apiPort: 8080}, () => done())
        )
      )
    );

    after(done =>
      server.stop(() =>
        auth.cleanupTestUsers(() => done())
      )
    );

    beforeEach(() => authDetails = auth.getAuthDetails());

    afterEach(done =>
      Visualizer.remove({}, () => done())
    );

    describe('*getVisualizers()', function() {

      it('should return a 200 response with a list of saved visualizers', function(done) {
        let vis1 = _.assign({}, visObj);
        vis1.name = 'Visualizer1';
        vis1 = new Visualizer(vis1);
        let vis2 = _.assign({}, visObj);
        vis2.name = 'Visualizer2';
        vis2 = new Visualizer(vis2);

        return vis1.save(function(err) {
          if (err) { return done(err); }
          return vis2.save(function(err) {
            if (err) { return done(err); }

            return request('https://localhost:8080')
              .get('/visualizers')
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) { return done(err); }
                
                res.body.should.be.an.Array();
                res.body.length.should.be.exactly(2);
                let names = res.body.map(vis => vis.name);
                (Array.from(names).includes('Visualizer1')).should.be.true();
                (Array.from(names).includes('Visualizer2')).should.be.true();
                return done();
            });
          });
        });
      });

      it('should return a 403 response if the user is not an admin', done =>
        request('https://localhost:8080')
          .get('/visualizers')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      return it('should return an empty array if there are no visualizers', done =>
        request('https://localhost:8080')
          .get('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(200)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            res.body.should.be.an.Array();
            res.body.length.should.be.exactly(0);
            return done();
        })
      );
    });


    describe('*getVisualizer(visualizerId)', function() {

      it('should return a 200 response with a specific visualizer', function(done) {
        let vis1 = _.assign({}, visObj);
        vis1.name = 'Visualizer1';
        vis1 = new Visualizer(vis1);
        let vis2 = _.assign({}, visObj);
        vis2.name = 'Visualizer2';
        vis2 = new Visualizer(vis2);

        return vis1.save(function(err) {
          if (err) { return done(err); }
          return vis2.save(function(err) {
            if (err) { return done(err); }

            return request('https://localhost:8080')
              .get(`/visualizers/${vis1._id}`)
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) { return done(err); }
                
                res.body.should.be.an.Object();
                res.body.should.have.property("name", "Visualizer1");
                return done();
            });
          });
        });
      });

      it('should return a 403 response if the user is not an admin', done =>
        request('https://localhost:8080')
          .get('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      return it('should return 404 with message if no visualizers match the _id', done =>
        request('https://localhost:8080')
          .get('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            res.text.should.equal("Visualizer with _id 111111111111111111111111 could not be found.");
            return done();
        })
      );
    });


    describe('*addVisualizer()', function() {

      it('should add a visualizer and return a 201 response', done =>
        request('https://localhost:8080')
          .post('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign({}, visObj))
          .expect(201)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            return Visualizer.findOne({ name: "Visualizer1" }, function(err, vis) {
              if (err) { return done(err); }
              return done();
            });
        })
      );

      it('should return a 403 response if the user is not an admin', done =>
        request('https://localhost:8080')
          .post('/visualizers')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign({}, visObj))
          .expect(403)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      return it('should return 404 if no request object is sent', done =>
        request('https://localhost:8080')
          .post('/visualizers')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            res.text.should.equal("Cannot Add Visualizer, no request object");
            return done();
        })
      );
    });


    describe('*updateVisualizer(visualizerId)', function() {

      it('should update a specific visualizer and return a 200 response', function(done) {
        let vis1 = _.assign({}, visObj);
        vis1.name = 'Visualizer1';
        vis1 = new Visualizer(vis1);
        
        let visUpdate = _.assign({}, visObj);
        visUpdate.name = 'VisualizerUpdate1';
        visUpdate.color.inactive = '#11111';
        
        return vis1.save(function(err) {
          if (err) { return done(err); }

          return request('https://localhost:8080')
            .put(`/visualizers/${vis1._id}`)
            .set('auth-username', testUtils.rootUser.email)
            .set('auth-ts', authDetails.authTS)
            .set('auth-salt', authDetails.authSalt)
            .set('auth-token', authDetails.authToken)
            .send(visUpdate)
            .expect(200)
            .end(function(err, res) {
              if (err) { return done(err); }
              
              return Visualizer.findOne({ name: "VisualizerUpdate1" }, function(err, vis) {
                if (err) { return done(err); }
                vis.color.should.have.property("inactive", "#11111");
                return done();
              });
          });
        });
      });

      it('should return a 403 response if the user is not an admin', done =>
        request('https://localhost:8080')
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign({}, visObj))
          .expect(403)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      it('should return 404 if no request object is sent', done =>
        request('https://localhost:8080')
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send()
          .expect(404)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            res.text.should.equal("Cannot Update Visualizer with _id 111111111111111111111111, no request object");
            return done();
        })
      );

      return it('should return 404 if no visualizers match the _id', done =>
        request('https://localhost:8080')
          .put('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .send(_.assign({}, visObj))
          .expect(404)
          .end(function(err, res) {
            if (err) { return done(err); }
            
            res.text.should.equal("Cannot Update Visualizer with _id 111111111111111111111111, does not exist");
            return done();
        })
      );
    });
  
  
    return describe('*removeVisualizer(visualizerId)', function() {

      it('should sucessfully remove a visualizer', function(done) {
        let vis1 = _.assign({}, visObj);
        vis1.name = 'Root\'s Visualizer 1';
        vis1 = new Visualizer(vis1);
        let vis2 = _.assign({}, visObj);
        vis2.name = 'Root\'s Visualizer 2';
        vis2 = new Visualizer(vis2);

        return vis1.save(function(err) {
          if (err) { return done(err); }
          return vis2.save(function(err) {
            if (err) { return done(err); }

            return request('https://localhost:8080')
              .del(`/visualizers/${vis1._id}`)
              .set('auth-username', testUtils.rootUser.email)
              .set('auth-ts', authDetails.authTS)
              .set('auth-salt', authDetails.authSalt)
              .set('auth-token', authDetails.authToken)
              .expect(200)
              .end(function(err, res) {
                if (err) { return done(err); }
                
                return Visualizer.find(function(err, visualizers) {
                  visualizers.length.should.be.exactly(1);
                  return done();
                });
            });
          });
        });
      });

      it('should return a 403 response if the user is not an admin', done =>
        request('https://localhost:8080')
          .delete('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.nonRootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(403)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );

      return it('should return a 404 when the visualizer doesn\'t exist', done =>
        request('https://localhost:8080')
          .delete('/visualizers/111111111111111111111111')
          .set('auth-username', testUtils.rootUser.email)
          .set('auth-ts', authDetails.authTS)
          .set('auth-salt', authDetails.authSalt)
          .set('auth-token', authDetails.authToken)
          .expect(404)
          .end(function(err, res) {
            if (err) { return done(err); }
            return done();
        })
      );
    });
  })
);