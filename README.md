# Abstract

This addon provides ability to control message filters via preferences.
This is mainly designed for corporate-use.

# Usage

## Remove message filters

If you want to remove existing message filters with some patterns,
then define preferences like:

    pref("extensions.force-filter-status@clear-code.com.disallow.patterns.0", "^action=\"Forward\"$");
    pref("extensions.force-filter-status@clear-code.com.disallow.patterns.1", "^action=\"Move to folder\"$");

Preference values are recognized as regular expressions. All message
filters matched to one of these patterns will be removed automatically.
Regular expressions are evaluated for each filter serialized to a
multiline string, like:

    name="List-Id XXXXX"
    enabled="yes"
    type="17"
    action="Move to folder"
    actionValue="imap://user@mail.example.com/XXXXX"
    condition="AND (\"list-id\",contains,XXXXX)"

# How to try

 1. Prepare the environment.
    1. Uninstall this addon.
    2. Go to "about:config".
    3. Reset all preferences under the branch: `extensions.force-filter-status@clear-code.com.disallow.patterns`
 2. Prepare filters to be removed, as:
    1. a filter to mark the mail as unread:
       
       * Name: `TO BE DELETED 1`
       * Conditon: (any condition)
       * Actions: `Mark As Unread`
       
    2. a filter to mark the mail as read:
       
       * Name: `TO BE DELETED 2`
       * Conditon: (any condition)
       * Actions: `Mark As Read`
       
 3. Install this addon.
 4. Go to "about:config".
 5. Add a new string preference, as:
    * Name: `extensions.force-filter-status@clear-code.com.disallow.patterns.0`
    * Value: `^name="TO BE DELETED.*"$`
 6. Restart Thunderbird.
 7. Go to filters manager.
 8. Confirm that two filter you created have disappeared from the list.

