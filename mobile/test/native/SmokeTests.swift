import XCTest

final class SmokeTests: XCTestCase {
  @MainActor
  func testPreviewNavigationMessageAndRelaunch() {
    continueAfterFailure = false
    let app = XCUIApplication(bundleIdentifier: "dev.godsonokutu.chatsphere.preview")
    app.launch()
    XCTAssertTrue(app.staticTexts["Email or phone number"].waitForExistence(timeout: 60))

    func tap(_ element: XCUIElement, scrolling: Bool = false) {
      if scrolling {
        for _ in 0..<5 {
          if element.isHittable { break }
          app.swipeUp()
        }
      }
      XCTAssertTrue(element.waitForExistence(timeout: 10))
      XCTAssertTrue(element.isHittable)
      element.tap()
    }
    tap(app.descendants(matching: .any).matching(identifier: "explore-preview").firstMatch, scrolling: true)
    tap(app.descendants(matching: .any).matching(identifier: "conversation-11").firstMatch)
    let composer = app.textViews["Message"]
    tap(composer)
    composer.typeText("Native preview smoke test")
    tap(app.buttons["Send message"])
    let sent = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", "Native preview smoke test")
    ).firstMatch
    XCTAssertTrue(sent.waitForExistence(timeout: 10))
    XCTAssertNotEqual(composer.value as? String, "Native preview smoke test")
    let thread = XCTAttachment(screenshot: app.screenshot())
    thread.name = "Native preview thread"
    thread.lifetime = .keepAlways
    add(thread)

    tap(app.buttons["Back to conversations"])
    tap(app.descendants(matching: .any).matching(identifier: "tab-You").firstMatch)
    let sample = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", "Mobile preview")
    ).firstMatch
    XCTAssertTrue(sample.waitForExistence(timeout: 10))
    tap(app.buttons.matching(NSPredicate(format: "label == %@", "Leave preview")).firstMatch, scrolling: true)
    XCTAssertTrue(app.staticTexts["Email or phone number"].waitForExistence(timeout: 10))
    app.terminate()
    app.launch()
    XCTAssertTrue(app.staticTexts["Email or phone number"].waitForExistence(timeout: 60))
    let auth = XCTAttachment(screenshot: app.screenshot())
    auth.name = "Native launch after restart"
    auth.lifetime = .keepAlways
    add(auth)
  }
}
