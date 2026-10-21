"""Native sample-APK smoke test using Android's ADB and UI Automator."""
import pathlib
import re
import subprocess
import time
import traceback
import xml.etree.ElementTree as ET

APP = "dev.godsonokutu.chatsphere.preview"
OUTPUT = pathlib.Path("ui-output")
OUTPUT.mkdir(exist_ok=True)
WIDTH, HEIGHT = 1080, 2400


def adb(*arguments, binary=False):
    result = subprocess.run(
        ["adb", "-s", "emulator-5554", *arguments],
        check=True, capture_output=True, timeout=30,
    )
    return result.stdout if binary else result.stdout.decode("utf8", errors="replace")


def hierarchy():
    adb("shell", "uiautomator", "dump", "/sdcard/chatsphere-ui.xml")
    xml = adb("exec-out", "cat", "/sdcard/chatsphere-ui.xml")
    (OUTPUT / "last-hierarchy.xml").write_text(xml, encoding="utf8")
    return ET.fromstring(xml)


def find(label, timeout=30, scroll=False, contains=False):
    deadline = time.monotonic() + timeout
    swipes = 0
    while time.monotonic() < deadline:
        root = hierarchy()
        for node in root.iter("node"):
            resource = node.get("resource-id", "")
            labels = [node.get("text", ""), node.get("content-desc", "")]
            match = label in labels or resource == label or resource.endswith(":id/" + label)
            if contains and node.get("class") != "android.widget.EditText":
                match = match or any(label in text for text in labels)
            if match:
                return node
        if scroll and swipes < 5:
            adb("shell", "input", "swipe", str(WIDTH // 2), str(HEIGHT * 4 // 5),
                str(WIDTH // 2), str(HEIGHT // 3), "400")
            swipes += 1
        time.sleep(0.5)
    raise AssertionError(f"Native element not visible: {label}")


def tap(label, scroll=False):
    node = find(label, scroll=scroll)
    left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
    assert right > left and bottom > top, f"Empty bounds: {label}"
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def screenshot(name):
    (OUTPUT / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p", binary=True))


def launch():
    adb("shell", "am", "force-stop", APP)
    adb("shell", "am", "start", "-W", "-n", APP + "/.MainActivity")


suite = ET.Element("testsuite", name="Android native preview", tests="1", failures="0")
case = ET.SubElement(suite, "testcase", name="Preview navigation, message send and relaunch")
started = time.monotonic()
failed = False
try:
    adb("wait-for-device")
    assert adb("get-state").strip() == "device"
    WIDTH, HEIGHT = map(int, re.findall(r"(\d+)x(\d+)", adb("shell", "wm", "size"))[-1])
    (OUTPUT / "device.txt").write_text(
        adb("shell", "getprop", "ro.build.version.release") +
        adb("shell", "getprop", "ro.product.cpu.abi"), encoding="utf8")
    adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")
    adb("shell", "wm", "dismiss-keyguard")
    adb("logcat", "-c")
    adb("shell", "pm", "clear", APP)
    launch()
    find("Email or phone number", timeout=60)
    tap("explore-preview", scroll=True)
    tap("conversation-11")
    tap("Message")
    adb("shell", "input", "text", "Native%spreview%ssmoke%stest")
    tap("Send message")
    find("Native preview smoke test", contains=True)
    assert find("Message").get("text") != "Native preview smoke test", "Composer did not clear"
    screenshot("thread")
    tap("Back to conversations")
    tap("tab-You")
    find("Mobile preview · sample account", contains=True)
    tap("Leave preview", scroll=True)
    find("Email or phone number")
    launch()
    find("Email or phone number", timeout=60)
    screenshot("auth")
    print("PASS Android native launch, preview, chat send, profile, exit and relaunch")
except Exception:
    failed = True
    suite.set("failures", "1")
    ET.SubElement(case, "failure").text = traceback.format_exc()
    traceback.print_exc()
    try:
        screenshot("failure")
    except Exception:
        pass
finally:
    case.set("time", str(round(time.monotonic() - started, 3)))
    ET.ElementTree(suite).write("android-ui.xml", encoding="utf8", xml_declaration=True)
    try:
        (OUTPUT / "logcat.txt").write_text(adb("logcat", "-d", "-t", "500"), encoding="utf8")
    except Exception:
        pass
if failed:
    raise SystemExit(1)
