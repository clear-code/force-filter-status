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

