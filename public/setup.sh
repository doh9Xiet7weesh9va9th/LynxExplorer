#!/bin/bash

# This script will setup the host OS, install all dependencies for Lynx and then execute the install
# script after a short wait time of 15 minutes. Some hosting vendors might require a manual reboot
# (i.e. HostBRZ) after the whole installation is complete.

# To get started, log into your VPS or Pi, and as root copy and paste the following line.

# wget -qO - https://test-explorer.getlynx.io/setup.sh | bash

# This will start the intallation. You can now close the session window in your termial or putty
# window. The script will run in the background without need for human interaction. Depending on the
# speed of your VPS or Pi2 or Pi3, the process will be complete anywhere from 45 minutes to 4 hours.

# For Pi users. If you are using LynxCI, this script is already installed so simply powering on
# your Pi is enough to start the process. No further interaction is needed after flashing your Micro
# SD card with the latest version of LynxCI, plugging it into your Pi and powering it one. This
# script will support Pi 2 and 3 only please.

IsProduction="N"

checkForRaspbian=$(cat /proc/cpuinfo | grep 'Revision')

echo "Updating the local operating system. This might take a few minutes."

if [ ! -z "$checkForRaspbian" ]; then

	# In case the VPS vendor doesn't have the locale set up right, (I'm looking at you, HostBRZ), run
	# this command to set the following values in a non-interactive manner. It should survive a reboot.

	echo "locales locales/default_environment_locale select en_US.UTF-8" | debconf-set-selections &> /dev/null
	echo "locales locales/locales_to_be_generated multiselect en_US.UTF-8 UTF-8" | debconf-set-selections &> /dev/null
	rm -rf "/etc/locale.gen"
	dpkg-reconfigure --frontend noninteractive locales &> /dev/null
	echo "Locale for the target host was set to en_US.UTF-8 UTF-8."

fi

# In the event that any other crontabs exist, let's purge them all.

crontab -r &> /dev/null

# Since the /boot/setup file existed, let's purge it to keep things cleaned up.

rm -rf /boot/setup

# Before we begin, we need to update the local repo's. For now, the update is all we need and the
# device will still function properly.

apt-get update -y &> /dev/null

# We need to ensure we have git for the following step. Let's not assume we already ahve it. Also
# added a few other tools as testing has revealed that some vendors didn't have them pre-installed.

apt-get install -y autoconf automake bzip2 curl nano htop make g++ gcc git git-core pkg-config build-essential libtool libncurses5-dev software-properties-common &> /dev/null

if [ ! -z "$checkForRaspbian" ]; then

	# Some hosting vendors already have these installed. They aren't needed, so we are removing them
	# now. This list will probably get longer over time.

	apt-get remove -y postfix apache2 &> /dev/null

fi

# Now that certain packages that might bring an interactive prompt are removed, let's do an upgrade.

apt-get upgrade -y &> /dev/null

# Lets not assume this is the first time the script has been attempted.

rm -rf /root/LynxCI/

echo "Local operating system is updated."

# We are downloading the latest package of build instructions from github.

git clone https://github.com/doh9Xiet7weesh9va9th/LynxCI.git /root/LynxCI/ &> /dev/null

# We cant assume the file permissions will be right, so lets reset them.

chmod 744 -R /root/LynxCI/

# In the event that any other crontabs exist, let's purge them all.

crontab -r &> /dev/null

if [ ! -z "$checkForRaspbian" ]; then

	# Since this is the first time the script is run, we will create a crontab to run it again
	# in a few minute, when a quarter of the hour rolls around.

	if [ "$IsProduction" = "Y" ]; then

		crontab -l | { cat; echo "*/15 * * * *		PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' /bin/sh /root/LynxCI/install.sh mainnet >> /var/log/syslog"; } | crontab -

	else

		crontab -l | { cat; echo "*/15 * * * *		PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' /bin/sh /root/LynxCI/installTest.sh testnet >> /var/log/syslog"; } | crontab -

	fi

else

	# Since this is the first time the script is run, we will create a crontab to run it again
	# in a few minute, when a quarter of the hour rolls around.

	if [ "$IsProduction" = "Y" ]; then

		crontab -l &> /dev/null | { cat; echo "*/15 * * * *		PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' /bin/sh /root/LynxCI/install.sh mainnet >> /var/log/syslog"; } | crontab -

	else

		crontab -l &> /dev/null | { cat; echo "*/15 * * * *		PATH='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' /bin/sh /root/LynxCI/installTest.sh testnet >> /var/log/syslog"; } | crontab -

	fi

fi

# This file is created for the Pi. In order for SSH to work, this file must exist.

touch /boot/ssh

# Now that the setup is complete, set this file so it doesn't run again.

touch /boot/setup

echo "

	 The unattended install will begin in 15 minutes or less.
	 You can log out now or watch the live install log by typing

	 $ tail -F /var/log/syslog

	 "


