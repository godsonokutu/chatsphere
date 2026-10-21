# Attach a black-box UI test target to Expo's generated Xcode project.
# The application source and production targets are not edited.
require "xcodeproj"

project_path = Dir.glob("ios/*.xcodeproj").first or abort "No generated iOS project"
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.product_type == "com.apple.product-type.application" }
abort "No application target" unless app
target = project.new_target(:ui_test_bundle, "ChatSphereNativeSmoke", :ios, app.deployment_target || "16.4")
target.add_dependency(app)
reference = project.main_group.new_file(File.expand_path("test/native/SmokeTests.swift"))
reference.source_tree = "<absolute>"
target.add_file_references([reference])
target.build_configurations.each do |configuration|
  configuration.build_settings["SWIFT_VERSION"] = "5.0"
  configuration.build_settings["ENABLE_TESTING_SEARCH_PATHS"] = "YES"
  configuration.build_settings["GENERATE_INFOPLIST_FILE"] = "YES"
  configuration.build_settings["PRODUCT_BUNDLE_IDENTIFIER"] = "dev.godsonokutu.chatsphere.preview.nativesmoke"
  configuration.build_settings["TEST_TARGET_NAME"] = app.name
  configuration.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
  configuration.build_settings["SUPPORTED_PLATFORMS"] = "iphonesimulator"
  configuration.build_settings["SDKROOT"] = "iphonesimulator"
  configuration.build_settings["TARGETED_DEVICE_FAMILY"] = "1"
end
project.root_object.attributes["TargetAttributes"] ||= {}
project.root_object.attributes["TargetAttributes"][target.uuid] = { "TestTargetID" => app.uuid }
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
scheme.test_action.build_configuration = "Release"
scheme.launch_action.build_configuration = "Release"
scheme.save_as(project.path, "ChatSphereNativeSmoke", true)
puts "Created native XCTest target for #{app.name}"
