#!/usr/bin/env bash

# Start
echo "macos.sh starting."

PROFILE="unknown"
if [[ -f "/tmp/.dotfiles-profile" ]]; then
    PROFILE="$(cat /tmp/.dotfiles-profile)"
fi

echo "Running against ${PROFILE} profile"


###############################################################################
# General System
###############################################################################
# Set computer name (as done via System Preferences → Sharing)
_hn="macbook"
_sudo_uuid=""
case "$PROFILE" in
"work")
    _hn="workbook"
    _sudo_uuid=$(. bin/1p list items | jq -r '.[] | select(.overview.title == "sudo - Atlassian") | .uuid')
    ;;  
*)
    _hn="macbook"
    _sudo_uuid=$(. bin/1p list items | jq -r '.[] | select(.overview.title == "sudo - Personal") | .uuid')
    ;;  
esac

# Ask for the administrator password upfront, pass it in as stdin
_sudo_pw=$(. bin/1p get item ${_sudo_uuid} | jq -r '.details.password')
echo -n ${_sudo_pw} | sudo -vS

# Keep-alive: update existing `sudo` time stamp until `.macos` has finished 
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &

sudo scutil --set ComputerName "$_hn"
sudo scutil --set HostName "$_hn"
sudo scutil --set LocalHostName "$_hn"
sudo defaults write /Library/Preferences/SystemConfiguration/com.apple.smb.server NetBIOSName -string "$_hn"

# Disable the sound effects on boot.  To re-enable: sudo nvram -d SystemAudioVolume
# macbook pro late 2012 + os x 10.9
sudo nvram SystemAudioVolume="%80"

# Enable verbose booting.  To reset to default: sudo nvram boot-args="" ; sudo nvram -d boot-args
#sudo nvram boot-args="-v"

###############################################################################
# General UI/UX
###############################################################################
echo "Applying General UI/UX"

# Menu bar: show remaining battery as a percentage
defaults write com.apple.menuextra.battery ShowPercent -string "YES"

# Scrollbars: Possible values: `WhenScrolling`, `Automatic` and `Always`
defaults write NSGlobalDomain AppleShowScrollBars -string "WhenScrolling"

# Expand save panel by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true

# Check for software updates daily, not just once per week
defaults write com.apple.SoftwareUpdate ScheduleFrequency -int 1

# Dark menubar and dock only, in Mojave. NOTE: You still need to enable Dark Mode in the 
# System Preferences UI
defaults write -g NSRequiresAquaSystemAppearance -bool Yes

# Clock
defaults write com.apple.menuextra.clock IsAnalog -bool false
defaults write com.apple.menuextra.clock DateFormat -string "EEE d MMM  HH:mm"
defaults write NSGlobalDomain AppleICUForce24HourTime -bool true

# Disable cursor size increase on mouse shake
defaults write NSGlobalDomain CGDisableCursorLocationMagnification -bool true

###############################################################################
# Trackpad, keyboard
###############################################################################
echo "Applying Trackpad, Keyboard"

# Trackpad: map bottom right corner to right-click
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadCornerSecondaryClick -int 2
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad TrackpadRightClick -bool true
defaults -currentHost write NSGlobalDomain com.apple.trackpad.trackpadCornerClickBehavior -int 1
defaults -currentHost write NSGlobalDomain com.apple.trackpad.enableSecondaryClick -bool true

# Trackpad: enable tap to click
defaults -currentHost write NSGlobalDomain "com.apple.mouse.tapBehavior" -int 1

# Trackpad: disable look up
defaults -currentHost write NSGlobalDomain "com.apple.trackpad.threeFingerTapGesture" -int 0

# Trackpad: enable 3 finger drag
defaults -currentHost write NSGlobalDomain "com.apple.trackpad.threeFingerDragGesture" -int 1

# Disable “natural” scrolling
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool false

# Trackpad: disable swipe between pages
defaults write NSGlobalDomain AppleEnableSwipeNavigateWithScrolls -bool false

# Trackpad: disable launchpad gesture
defaults write com.apple.dock showLaunchpadGestureEnabled -bool false

# Trackpad: disable show desktop gesture
defaults -currentHost write NSGlobalDomain "com.apple.trackpad.fiveFingerPinchSwipeGesture" -int 0
defaults -currentHost write NSGlobalDomain "com.apple.trackpad.fourFingerPinchSwipeGesture" -int 0

# Trackpad: swipe between pages with three fingers
defaults -currentHost write NSGlobalDomain com.apple.trackpad.threeFingerHorizSwipeGesture -int 1

# Keyboard: enable full keyboard access for all controls, (e.g. enable Tab in modal dialogs)
defaults write NSGlobalDomain AppleKeyboardUIMode -int 2

# Keyboard: enable function keys
defaults write NSGlobalDomain com.apple.keyboard.fnState -int 1

# Keyboard: enable repeating alpha/num keys
defaults write -g ApplePressAndHoldEnabled -bool false

###############################################################################
# Screen
###############################################################################
echo "Applying Screen"

# Require password 5 seconds after sleep or screen saver begins
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 5

# Save screenshots to the Pictures directory
defaults write com.apple.screencapture location -string "${HOME}/Pictures/screenshots"

# Save screenshots in PNG format (other options: BMP, GIF, JPG, PDF, TIFF)
defaults write com.apple.screencapture type -string "png"

# Disable shadow in screenshots
defaults write com.apple.screencapture disable-shadow -bool true

###############################################################################
# Finder
###############################################################################
echo "Applying Finder"

# Icons for hard drives, servers, and removable media on the desktop
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool false
defaults write com.apple.finder ShowHardDrivesOnDesktop -bool false
defaults write com.apple.finder ShowMountedServersOnDesktop -bool false
defaults write com.apple.finder ShowRemovableMediaOnDesktop -bool false

# Finder: show hidden files by default
#defaults write com.apple.finder AppleShowAllFiles -bool true

# Finder: keep folders on top when sorting by name
defaults write com.apple.finder _FXSortFoldersFirst -bool true

# Finder: show full path in title
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Finder: show status bar
defaults write com.apple.finder ShowStatusBar -bool true

# Finder: show path bar
defaults write com.apple.finder ShowPathbar -bool true

# Finder: allow text selection in Quick Look
defaults write com.apple.finder QLEnableTextSelection -bool true

# When performing a search, search the current folder by default
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable the warning when changing a file extension
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Use list view in all Finder windows by default
# Four-letter codes for the other view modes: `icnv`, `clmv`, `Flwv`
defaults write com.apple.finder FXPreferredViewStyle -string "clmv"

# Disable the warning before emptying the Trash
defaults write com.apple.finder WarnOnEmptyTrash -bool false

# Empty Trash securely by default
#defaults write com.apple.finder EmptyTrashSecurely -bool true

# Finder: show all filename extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Avoid creating .DS_Store files on network volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true

# Show the ~/Library folder
chflags nohidden "$HOME/Library"

###############################################################################
# Dock, Dashboard, and hot corners
###############################################################################
echo "Applying Dock, Dashboard"

# Dock: minimise and maximise effect.
# Possible settings: genie, scale
defaults write com.apple.dock mineffect -string "scale"

# Show indicator lights for open applications in the Dock
defaults write com.apple.dock show-process-indicators -bool true

# Don’t animate opening applications from the Dock
defaults write com.apple.dock launchanim -bool true

# Speed up Mission Control animations
#defaults write com.apple.dock expose-animation-duration -float 0.1

# Don’t show Dashboard as a Space
defaults write com.apple.dock dashboard-in-overlay -bool true

# Don’t automatically rearrange Spaces based on most recent use
defaults write com.apple.dock mru-spaces -bool false

# Remove the auto-hiding Dock delay
defaults write com.apple.dock autohide-delay -float 0
# Remove the animation when hiding/showing the Dock
defaults write com.apple.dock autohide-time-modifier -int 0

# Automatically hide and show the Dock
#defaults write com.apple.dock autohide -bool true

# Minimise applications to their icon
defaults write com.apple.dock "minimize-to-application" -bool true

# Hot corners: bottom right screen corner = start screen saver
defaults write com.apple.dock wvous-br-corner -int 5
defaults write com.apple.dock wvous-br-modifier -int 0

###############################################################################
# Energy preferences
###############################################################################
echo "Applying Energy Preferences"

# battery
sudo pmset -b sleep 20 disksleep 15 displaysleep 10 halfdim 1

# power adapter
sudo pmset -c sleep 0 disksleep 0 displaysleep 10 halfdim 1

###############################################################################
# Firewall
###############################################################################
echo "Applying Firewall"

# Enable the firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

# Do not auto allow signed apps
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setallowsigned off

# Enable stealth mode
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
