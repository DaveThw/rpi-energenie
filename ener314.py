# Written by Dave Thwaites
#
# Inspiration taken from:
# http://stackoverflow.com/questions/8600161/executing-periodic-actions-in-python#answer-8600329
# and NodeRED nrgpio.py code
# and Energenie's ENER002-PI2.py example code

# from threading import Timer
from threading import Thread
from threading import Event
from time import sleep
from collections import deque
import sys
try:
    import RPi.GPIO as GPIO
except RuntimeError:
    print("Error importing RPi.GPIO!  This is probably because you need superuser"
          " privileges.  You can achieve this by using 'sudo' to run your script")
    sys.exit(0)


# Pins for ENER314 add-on card
ener314_D0 = 11
ener314_D1 = 15
ener314_D2 = 16
ener314_D3 = 13
ener314_ModSel = 18
ener314_enable = 22

try:
    # set the pins numbering mode
    GPIO.setmode(GPIO.BOARD)
    
    if GPIO.gpio_function(ener314_D0) == GPIO.OUT :
        # GPIO pin is already in use - might be another / a previous instance of this script
        # ...so wait 5s before trying to set things up
        print("GPIO pins currently in use - waiting 5 seconds...")
        sleep(5)

    # Select the GPIO pins used for the encoder K0-K3 data inputs
    GPIO.setup(ener314_D0, GPIO.OUT)
    GPIO.setup(ener314_D1, GPIO.OUT)
    GPIO.setup(ener314_D2, GPIO.OUT)
    GPIO.setup(ener314_D3, GPIO.OUT)
    
    # Select the signal to select ASK/FSK
    GPIO.setup(ener314_ModSel, GPIO.OUT)
    
    # Select the signal used to enable/disable the modulator
    GPIO.setup(ener314_enable, GPIO.OUT)
except RuntimeError:
    print("Error setting up GPIO pins!  This is probably because you need superuser"
          " privileges.  You can achieve this by using 'sudo' to run your script")
    sys.exit(0)

# Disable the modulator by setting CE pin lo
GPIO.output(ener314_enable, False)

# Set the modulator to ASK for On Off Keying by setting MODSEL pin low
GPIO.output(ener314_ModSel, False)


# print ("Enter items to be added to the queue - they will be returned (roughly)"
#        "3 seconds apart")
# print "Enter 'exit' to exit."


def bg():
    print "Starting background thread..."
    while not exitflag.is_set():
        if len(queue) > 0:
            while len(queue) > 0 and not exitflag.is_set():
                item = queue.popleft()
                # print "Next item: switch", item[0], "-", item[1].title()
                send(item[0], item[1])
                print item[0], "-", item[1].title()
                exitflag.wait(3)
            if len(queue) > 0:
                # print len(queue), "items left in queue!"
                pass
            else:
                # print "No items left!"
                pass
    print "Stopping background thread..."

def send(switch, value):
    if switch == "1":
        GPIO.output(ener314_D0, 1)
        GPIO.output(ener314_D1, 1)
        GPIO.output(ener314_D2, 1)
        # print "Switch 1",
    elif switch == "2":
        GPIO.output(ener314_D0, 0)
        GPIO.output(ener314_D1, 1)
        GPIO.output(ener314_D2, 1)
        # print "Switch 2",
    elif switch == "3":
        GPIO.output(ener314_D0, 1)
        GPIO.output(ener314_D1, 0)
        GPIO.output(ener314_D2, 1)
        # print "Switch 3",
    elif switch == "4":
        GPIO.output(ener314_D0, 0)
        GPIO.output(ener314_D1, 0)
        GPIO.output(ener314_D2, 1)
        # print "Switch 4",
    elif switch == "all":
        GPIO.output(ener314_D0, 1)
        GPIO.output(ener314_D1, 1)
        GPIO.output(ener314_D2, 0)
        # print "All switches",
    if value == "on":
        GPIO.output(ener314_D3, 1)
        # print "On",
    else:
        GPIO.output(ener314_D3, 0)
        # print "Off",
    # let it settle, encoder requires this
    sleep(0.1)	
    # Enable the modulator
    # print "- sending...",
    GPIO.output(ener314_enable, True)
    # keep enabled for a period
    sleep(0.25)
    # Disable the modulator
    GPIO.output(ener314_enable, False)
    # print "done!"


queue = deque()
exitflag = Event()
bg_thread = Thread(None, bg)
bg_thread.start()

while True:
    try:
        ip = raw_input().lower()
        if 'exit' in ip:
            sys.exit(0)
        if ip != "":
            data = ip.split()
            if len(data) != 2:
                print "Bad input - expecting two parameters!"
                continue
            # if not data[0].isdigit() and data[0]!="all":
            #     print "Bad input - first parameter should be a digit or 'All'"
            #     continue
            if ( ( data[0].isdigit() and ( int(data[0])<1 or int(data[0])>4 ) )
                or ( not data[0].isdigit() and data[0]!="all" ) ):
                print ("Bad input - first parameter should be a digit between"
                       " 1-4 or 'All'")
                continue
            if data[1]!="on" and data[1]!="off":
                print "Bad input - second parameter should be 'On' or 'Off'"
                continue
            queue.append(data)
            # print "len(queue) =", len(queue)
            # print "bg_thread.is_alive() =", bg_thread.is_alive()
    except (KeyboardInterrupt, EOFError, SystemExit):
        print "Exiting..."
        exitflag.set()
        GPIO.cleanup()
        sys.exit(0)
    except Exception as ex:
        print "Unexpected Exception!"
        #print "sys.exc_info()[0]:", sys.exc_info()[0]
        #print "ex:", ex
        print "ip:", ip
        #print "Exiting..."
        exitflag.set()
        GPIO.cleanup()
        # sys.exit(0)
        raise
    
