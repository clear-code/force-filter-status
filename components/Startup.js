const DEBUG = false;

var gLogger = {
  messages: [],
  log: function(aMessage) {
    this.messages.push(aMessage);
    this.output(aMessage);
  },
  output: function(aMessage) {
    if (!DEBUG)
      return;
    Components.utils.import('resource://force-filter-status-modules/lib/textIO.jsm');
    var file = Cc['@mozilla.org/file/directory_service;1']
                 .getService(Ci.nsIProperties)
                 .get('Desk', Ci.nsIFile);
    file.append('force-filter-status.log');
    var previous = textIO.readFrom(file, 'UTF-8') || '';
    var log;
    if (aMessage) {
      log = previous + '\n[' + (new Date()) + '] ' + aMessage;
    } else {
      log = [previous, this.messages.join('\n')].join('\n-----' + (new Date()) + '-----\n');
    }
    textIO.writeTo(log, file, 'UTF-8');
/*
    Cc['@mozilla.org/embedcomp/prompt-service;1']
      .getService(Ci.nsIPromptService)
      .alert(null, kID, file.path+'\n\n'+this.messages.join('\n'));;
*/
  }
}

const kCID  = Components.ID('{c7a54030-3fd4-11e4-916c-0800200c9a66}'); 
const kID   = '@clear-code.com/force-filter-status/startup;1';
const kNAME = 'ForceFilterStatusStartupService';

const Cc = Components.classes;
const Ci = Components.interfaces;

const ObserverService = Cc['@mozilla.org/observer-service;1']
                         .getService(Ci.nsIObserverService);

Components.utils.import('resource://force-filter-status-modules/lib/prefs.js');
Components.utils.import('resource://force-filter-status-modules/lib/jsdeferred.js');

const BASE = 'extensions.force-filter-status@clear-code.com.';

function ForceFilterStatusStartupService() { 
  this.ready = false;
  this.active = false;
}
ForceFilterStatusStartupService.prototype = {
  classID          : kCID,
  contractID       : kID,
  classDescription : kNAME,
   
  observe : function(aSubject, aTopic, aData) 
  {
    gLogger.log('observe: ' + aTopic);
    switch (aTopic)
    {
      case 'profile-after-change':
        ObserverService.addObserver(this, 'final-ui-startup', false);
        ObserverService.addObserver(this, 'sessionstore-windows-restored', false);
        ObserverService.addObserver(this, 'mail-startup-done', false);
        return;

      case 'final-ui-startup':
        ObserverService.removeObserver(this, 'final-ui-startup');
        this.registerListener();
        var self = this;
        return this.waitUntilStarted()
          .next(function() {
            return self.checkFilters();
          });
        return;

      case 'sessionstore-windows-restored':
      case 'mail-startup-done':
        ObserverService.removeObserver(this, 'sessionstore-windows-restored');
        ObserverService.removeObserver(this, 'mail-startup-done');
        this.ready = true;
        if (this.waitUntilStarted_trigger)
          this.waitUntilStarted_trigger.call();
        return;
    }
  },
 
  checkFilters : function() 
  {
    if (this.checking)
      return;
    this.checking = true;

    var self = this;
    var changedCount = { value : 0 };
    return Deferred.next(function() {
        return self.removeDisallowedFilters(changedCount);
      })
      .error(function(error) {
        Components.utils.reportError(error);
        gLogger.log('unexpected error: ' + error + '\n' + error.stack);
      })
      .next(function() {
        self.checking = false;
        if (changedCount.value > 0)
          self.restart();
      });
  },

  removeDisallowedFilters : function(aChangedCount)
  {
    var prefEntries = prefs.getDescendants(BASE + 'disallow.patterns.');
    if (prefEntries.length == 0)
      return;

    prefEntries.forEach(function(aKey) {
      var pattern = prefs.getPref(aKey);
      if (!pattern)
        return null;

      //XXX implement me!!
      // aChangedCount.value++;
    });
  },


  waitUntilStarted : function() {
    if (this.ready)
      return;

    this.waitUntilStarted_trigger = new Deferred();
    return this.waitUntilStarted_trigger;
  },

  restart : function()
  {
    gLogger.log('try to restart');
    Cc['@mozilla.org/toolkit/app-startup;1']
      .getService(Ci.nsIAppStartup)
      .quit(Ci.nsIAppStartup.eRestart | Ci.nsIAppStartup.eAttemptQuit);
  },
  
  QueryInterface : function(aIID) 
  {
    if(!aIID.equals(Ci.nsIObserver) &&
       !aIID.equals(Ci.nsISupports)) {
      throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    return this;
  }
};

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
var NSGetFactory = XPCOMUtils.generateNSGetFactory([ForceFilterStatusStartupService]);
