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

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;
var Cr = Components.results;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyServiceGetter(this,
                                   'AccountManager',
                                   '@mozilla.org/messenger/account-manager;1',
                                   'nsIMsgAccountManager');
XPCOMUtils.defineLazyServiceGetter(this,
                                   'MailSession',
                                   '@mozilla.org/messenger/services/session;1',
                                   'nsIMsgMailSession');
XPCOMUtils.defineLazyServiceGetter(this,
                                   'ObserverService',
                                   '@mozilla.org/observer-service;1',
                                   'nsIObserverService');

Cu.import('resource://force-filter-status-modules/lib/prefs.js');
Cu.import('resource://force-filter-status-modules/lib/jsdeferred.js');

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

  get allExistingFilters() {
    var filters = [];
    this.allExistingFilterLists.forEach(function(aFilterList) {
      for (var i = aFilterList.filterCount - 1; i > -1; i--) {
        let filter = aFilterList.getFilterAt(i);
        filters.push({
          raw:        filter,
          serialized: this.serializeFilter(filter),
          list:       aFilterList,
          index:      i
        });
      }
    }, this);
    return filters;
  },
  serializeFilter : function(aFilter) {
    var serialized = '';
    var stream = {
      close: function() {},
      flush: function() {},
      write: function(aString, aCount) {
        serialized += aString;
        return aCount;
      },
      writeFrom: function(aInputStream, aCount) {
        return aCount;
      },
      isNonBlocking: function() {
        return false;
      }
    };
    aFilter.SaveToTextFile(stream);
    return decodeURIComponent(escape(serialized));
  },

  get allExistingFilterLists() {
    var filterLists = [];
    this.allIncomingServers.forEach(function(aIncomingServer) {
      try {
        filterLists.push(aIncomingServer.getFilterList(MailSession.topmostMsgWindow));
      }
      catch(e) {
        // this fails for local folder account
      }
    }, this);
    return filterLists;
  },

  get allIncomingServers() {
    var servers = [];
    this.allAccounts.forEach(function(aAccount) {
      if (aAccount.incomingServer)
        servers.push(aAccount.incomingServer);
    }, this);
    return servers;
  },

  get allAccounts() {
    return this.toArray(AccountManager.accounts, Ci.nsIMsgAccount);
  },
  get allAccountKeys() {
    return this.allAccounts.map(function(aAccount) {
      return this.getAccountKey(aAccount);
    }, this).filter(function(aKey) {
      return aKey != '';
    });
  },
  toArray: function (aEnumerator, aInterface) {
    aInterface = aInterface || Ci.nsISupports;
    var array = [];
    if (aEnumerator instanceof Ci.nsISupportsArray) {
      let count = aEnumerator.Count();
      for (let i = 0; i < count; i++) {
        array.push(aEnumerator.QueryElementAt(i, aInterface));
      }
    } else if (aEnumerator instanceof Ci.nsIArray) {
      let count = aEnumerator.length;
      for (let i = 0; i < count; i++) {
        array.push(aEnumerator.queryElementAt(i, aInterface));
      }
    } else if (aEnumerator instanceof Ci.nsISimpleEnumerator) {
      while (aEnumerator.hasMoreElements()) {
        array.push(aEnumerator.getNext().QueryInterface(aInterface));
      }
    }
    return array;
  },
 
  checkFilters : function() 
  {
    if (this.checking)
      return;
    this.checking = true;

    var self = this;
    var changedCount = { value : 0 };
    var existingFilters = this.allExistingFilters;
    return Deferred.next(function() {
        return self.removeDisallowedFilters(existingFilters, changedCount);
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

  removeDisallowedFilters : function(aFilters, aChangedCount)
  {
    var prefEntries = prefs.getDescendants(BASE + 'disallow.patterns.');
    if (prefEntries.length == 0)
      return;

    var patterns = [];
    prefEntries.forEach(function(aKey) {
      var pattern = prefs.getPref(aKey);
      if (!pattern)
        return;

      patterns.push(pattern);
    }, this);

    if (patterns.length == 0)
      return;

    patterns = new RegExp(patterns.join('|'), 'im');

    var beforeCount = aChangedCount.value;
    for (var i = aFilters.length - 1; i > -1; i--) {
      let filter = aFilters[i];
      if (patterns.test(filter.serialized)) {
        filter.list.removeFilterAt(filter.index);
        aFilters.splice(i, 1);
        aChangedCount.value++;
      }
    }
    if (aChangedCount.value != beforeCount)
      this.allExistingFilterLists.forEach(function(aFilterList) {
        aFilterList.saveToDefaultFile();
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
