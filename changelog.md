### v0.5.6
- Add type Switch

### v0.5.5
- Update GoogleDrive dependency

### v0.5.4
- Fix GoogleDrive issue

### v0.5.3
- Added an optional parameter to disable the automatic repetition of the last entry every 10 minutes

### v0.5.2
- Initial support for Aqua accessory type

### v0.5.1
- Improves reliability when a new iDevice starts downloading an existing history that has already rolled up.
- Added isHistoryLoaded() function

### v0.5.0
- Fixes for google drive availability issues (#54). NOTE: On certain systems (e.g. macOS), previus versions may append ".local" or ".lan" after *hostname* in the file name. This additional portions are now removed to improve reliability of persistence on google drive when network goes down. If you do not want to loose your previous history, before updating check if your system creates files with the additional portion, and if so, rename them.
- Added possibility to leverage fakegato persistance capability to save extra user data

### v0.4.3
- fix for "room" when internal timer is not enabled

### v0.4.2
- fix bug when internal timer is not enabled
- add optional parameter for filename

### v0.4.1
- fix filesystem persist location when -U option is used in homebridge

### v0.4.0
- added ability to persist history either to filesystem or to google drive
- added option to disable internal timer
- various fixes on internal timer average calculation
- now also Energy uses the global internal timer
- added initialTime and getter, for external management of characteristics 11A (last opening/activation on Door/Motion)

### v0.3.8
- improve protocol to ensure prompt download of data even if Eve is missing a single entry (before this commit, two new entries were necessary for Eve to start downloading)

### v0.3.7
- fix to allow showing last activation in Door and Motion

### v0.3.6
- added compatibility with platfoms

### v0.3.5
- added internal global timer

### v0.3.4
- added Door, Motion, Room and Thermo support

### v0.3.3
- cleanup

### v0.3.2
- first NPM release

### v0.3.1
- first fully working version

### v0.3.0
- update readme, fix package.json
- added transmission of several entries per query

### v0.2
- added support for memory rolling

### v0.1
- initial commit (only Energy and Weather)
