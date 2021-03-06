SourceIn    = $src "master/source_in"
Stream      = $src "master/stream"
Logger      = $src "logger"
IcecastSource = $src "util/icecast_source"

mp3 = $file "mp3/mp3-44100-128-s.mp3"

net = require "net"

debug = require("debug")("sm:tests:source_in")

STREAM =
    key:                "valid"
    source_password:    "abc123"
    seconds:            180
    format:             "mp3"

class FakeMaster
    constructor: (stream) ->
        @streams = {}
        @streams[stream.key] = stream

        @stream_groups = {}

        @log = new Logger stdout:false

describe "Source In", ->
    stream = new Stream null, STREAM.key, (new Logger stdout:false), STREAM
    master = new FakeMaster stream

    it "should reject an invalid request", (done) ->
        source_in = new SourceIn core:master, port:0, behind_proxy:false
        source_in.listen()

        source_in.server.once "listening", ->
            debug "SourceIn listening on port #{ source_in.server.address().port }"

            # create a connection
            sock = net.connect port:source_in.server.address().port, ->
                debug "Connected"

                # when we write junk, we expect to just get disconnected. we'll
                # use a timeout to test that.
                t = setTimeout ->
                    done new Error "Socket was not closed after we wrote junk."
                , 1000

                sock.write "JUNK!!!!\r\n\r\n"

                sock.once "close", ->
                    debug "Junk source disconnected."
                    clearTimeout t
                    done()

    it "should accept a source with a valid password", (done) ->
        source_in = new SourceIn core:master, port:0, behind_proxy:false
        source_in.listen()

        source_in.server.once "listening", ->
            debug "SourceIn listening on port #{ source_in.server.address().port }"

            source = new IcecastSource
                format:     "mp3"
                filePath:   mp3
                host:       "127.0.0.1"
                port:       source_in.server.address().port
                stream:     STREAM.key
                password:   STREAM.source_password

            source.start (err) ->
                throw err if err
                debug "Connected with valid password"

                # we should also see the source on the stream...
                expect(stream.sources).to.have.length 1

                # clean up
                source.disconnect()

                done()

    it "should reject a source with an invalid password", (done) ->
        source_in = new SourceIn core:master, port:0, behind_proxy:false
        source_in.listen()

        source_in.server.once "listening", ->
            debug "SourceIn listening on port #{ source_in.server.address().port }"

            source = new IcecastSource
                format:     "mp3"
                filePath:   mp3
                host:       "127.0.0.1"
                port:       source_in.server.address().port
                stream:     STREAM.key
                password:   "bad_password"

            source.start (err) ->
                expect(err).to.not.be.null
                debug "Failed to connect with invalid password"

                # we should also see the source on the stream...
                expect(stream.sources).to.have.length 0

                done()



