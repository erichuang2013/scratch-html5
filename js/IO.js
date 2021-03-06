// Copyright (C) 2013 Massachusetts Institute of Technology
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 2,
// as published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

// Scratch HTML5 Player
// IO.js
// Tim Mickel, March 2012

// IO handles JSON communication and processing.
// We make the sprites and threads here.

'use strict';

var IO = function() {
    this.data = null;
    // In production, simply use the local path (no proxy)
    // since we won't be hampered by the same-origin policy.
    this.base = 'proxy.php?resource=internalapi/';
    this.project_base = this.base + 'project/'; 
    this.project_suffix = '/get/';
    this.asset_base = this.base + 'asset/';
    this.asset_suffix = '/get/';
    this.soundbank_base = 'soundbank/';
    this.spriteLayerCount = 0;
}
  
IO.prototype.loadProject = function(project_id) {
    var runningIO = this;
    $.getJSON(this.project_base + project_id + this.project_suffix,
        function(data) {
            runningIO.data = data;
            runningIO.makeObjects();
            runningIO.loadThreads();
            runningIO.loadNotesDrums();
            runtime.loadStart(); // Try to run the project.
        }
    );
}

IO.prototype.soundRequest = function(sound, sprite) {
    var request = new XMLHttpRequest();
    request.open('GET', this.asset_base + sound['md5'] + this.asset_suffix, true);
    request.responseType = 'arraybuffer';
    request.onload = function() {
        var waveData = request.response;
        // Decode the waveData and populate a buffer channel with the samples
        var snd = new SoundDecoder(waveData);
        var samples = snd.getAllSamples();
        sound.buffer = runtime.audioContext.createBuffer(1, samples.length, runtime.audioContext.sampleRate);
        var data = sound.buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) {
            data[i] = samples[i];
        }
        sprite.soundsLoaded++;
    }
    request.send();
}

IO.prototype.loadNotesDrums = function() {
    var self = this;
    $.each(Instr.wavs, function(name, file) {
        var request = new XMLHttpRequest();
        request.open('GET', self.soundbank_base + escape(file), true);
        request.responseType = 'arraybuffer';
        request.onload = function() {
            var waveData = new OffsetBuffer(request.response);
            // Decode the waveData and populate a buffer channel with the samples
            var info = WAVFile.decode(request.response);
            waveData.offset = info.sampleDataStart;
            var soundBuffer = waveData.readBytes(2 * info.sampleCount);
            Instr.samples[name] = soundBuffer;
            Instr.wavsLoaded++;
        }
        request.send();
    });
}
  
IO.prototype.makeObjects = function() {
    // Create the stage
    runtime.stage = new Stage(this.data);
    runtime.stage.attach(runtime.scene);
    runtime.stage.attachPenLayer(runtime.scene);
    runtime.stage.loadSounds();
    
    // Create the sprites
    $.each(this.data.children, function(index, obj) {
        var newSprite;
        if(!obj.cmd) {
            newSprite = new Sprite(obj);
        } else {
            newSprite = new Reporter(obj);
            runtime.reporters.push(newSprite);
        }
        runtime.sprites.push(newSprite);
        newSprite.attach(runtime.scene);
        if (!obj.cmd)
            newSprite.loadSounds();
    });
}
  
IO.prototype.loadThreads = function() {
    var target = runtime.stage;
    var scripts = target.data.scripts;
    if (scripts) {
        for (var s in scripts) {
            target.stacks.push(interp.makeBlockList(scripts[s][2]));
        }
    }
    $.each(this.data.children, function(index, obj) {
        target = runtime.sprites[index];
        if (typeof(target) != 'undefined' && target.data && target.data.scripts) {
            $.each(target.data.scripts, function(j, s) {
                target.stacks.push(interp.makeBlockList(s[2]));
            });
        } 
    });
}

// Returns the number sprite we are rendering
// used for initial layering assignment
IO.prototype.getCount = function() {
    var rv = this.spriteLayerCount;
    this.spriteLayerCount++;
    return rv;
}
