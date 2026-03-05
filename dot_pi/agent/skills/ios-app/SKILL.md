---
name: ios-app
description: "Build, test, and maintain iOS apps using Swift, SwiftUI, UIKit bridging, and XcodeGen. Use when creating new iOS projects, adding features, writing tests, configuring CI, or working with device APIs."
---

# iOS App Development Skill

Reference for building iOS apps. Covers project setup, architecture, SwiftUI/UIKit patterns, local storage, networking, testing, CI, and simulator workflows.

---

## 1. Project Setup with XcodeGen

**Never edit `.xcodeproj` by hand.** Use XcodeGen with `project.yml` as the source of truth.

### Minimal project.yml

```yaml
name: MyApp
options:
  bundleIdPrefix: com.yourname
  deploymentTarget:
    iOS: "17.0"
  xcodeVersion: "26.2"
  generateEmptyDirectories: true

settings:
  SWIFT_VERSION: "6.0"

targets:
  MyApp:
    type: application
    platform: iOS
    sources:
      - MyApp
    info:
      path: MyApp/Info.plist
      properties:
        CFBundleDisplayName: "My App"
        UILaunchScreen: {}
        UISupportedInterfaceOrientations:
          - UIInterfaceOrientationPortrait
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.yourname.myapp
      MARKETING_VERSION: "1.0.0"
      CURRENT_PROJECT_VERSION: 1
      DEVELOPMENT_TEAM: AU64BVS35L
      CODE_SIGN_IDENTITY: "Apple Development"
      CODE_SIGN_STYLE: Automatic
      INFOPLIST_FILE: MyApp/Info.plist
      SWIFT_STRICT_CONCURRENCY: minimal
      ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon

  MyAppTests:
    type: bundle.unit-test
    platform: iOS
    sources:
      - MyAppTests
    dependencies:
      - target: MyApp
    settings:
      PRODUCT_BUNDLE_IDENTIFIER: com.yourname.myapp.tests
      CODE_SIGN_IDENTITY: ""
      CODE_SIGNING_REQUIRED: "NO"
      GENERATE_INFOPLIST_FILE: "YES"
      SWIFT_STRICT_CONCURRENCY: minimal
```

### Permission usage descriptions

Add to `info.properties` in `project.yml` as needed:

```yaml
NSCameraUsageDescription: "Reason for camera access."
NSPhotoLibraryUsageDescription: "Reason for photo library access."
NSFaceIDUsageDescription: "Reason for Face ID."
NSMicrophoneUsageDescription: "Reason for microphone."
NSLocationWhenInUseUsageDescription: "Reason for location."
```

### Regenerate after any file changes

```bash
cd /path/to/project && xcodegen generate
```

**You must run this after adding, removing, or renaming any Swift file.**

---

## 2. Project Structure

```
MyApp/
├── project.yml                  # XcodeGen project definition (source of truth)
├── MyApp.xcodeproj/             # Generated — never edit by hand
├── MyApp/                       # App source
│   ├── MyAppApp.swift           # @main entry point
│   ├── AppState.swift           # Enums, settings, persisted state
│   ├── MainContainerView.swift  # Root view, mode switching, wiring
│   ├── <Feature>View.swift      # One file per major screen
│   ├── <Service>.swift          # Business logic / engines
│   ├── Info.plist               # Permissions
│   └── Assets.xcassets/         # App icon and image assets
└── MyAppTests/                  # Unit tests (Swift Testing framework)
    └── <Feature>Tests.swift     # Mirror source structure
```

**Conventions:**
- One file per major view or service
- Suffix views with `View`, services with `Engine` or `Service` or `Store`
- Keep models/enums in `AppState.swift` or a dedicated `Models.swift`
- UIKit bridging representables can live in the same file as the SwiftUI view that uses them

---

## 3. App Architecture

### Entry Point

```swift
import SwiftUI

@main
struct MyAppApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var someStore = SomeStore()

    var body: some Scene {
        WindowGroup {
            MainContainerView()
                .environmentObject(appState)
                .environmentObject(someStore)
        }
    }
}
```

- Create `@StateObject` instances at the `@main` struct level
- Inject via `.environmentObject()` — not via init parameters
- Views access shared state with `@EnvironmentObject`

### State Management with UserDefaults

```swift
class AppState: ObservableObject {
    @Published var currentMode: AppMode = .home

    // Persisted settings — didSet writes to UserDefaults
    @Published var someSetting: SomeEnum {
        didSet { UserDefaults.standard.set(someSetting.rawValue, forKey: "someSetting") }
    }

    init() {
        // Load persisted values with safe fallback to defaults
        self.someSetting = UserDefaults.standard.string(forKey: "someSetting")
            .flatMap { SomeEnum(rawValue: $0) } ?? .defaultValue
    }
}
```

**Key rules:**
- `@Published` properties with `didSet` for persistence to `UserDefaults`
- Load in `init()` with safe fallback using `.flatMap`
- For int-backed enums: `UserDefaults.object(forKey:) as? Int` then init from raw value
- For large data (images): `UserDefaults.data(forKey:)`
- Use `@AppStorage` only for lightweight, non-critical UI preferences

### Enum Design

```swift
enum SomeOption: String, CaseIterable, Codable, Identifiable {
    case optionA = "Option A"
    case optionB = "Option B"

    var id: String { rawValue }

    // Map to framework types when needed
    var frameworkValue: SomeFrameworkType {
        switch self {
        case .optionA: return .typeA
        case .optionB: return .typeB
        }
    }
}
```

- `String` raw values for human-readable display in pickers
- `Int` raw values for enums persisted as integers
- Conform to `CaseIterable, Codable, Identifiable`
- Computed properties to map to framework-specific types

### Mode-Based Navigation

For apps that switch between distinct modes rather than hierarchical push/pop:

```swift
struct MainContainerView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        ZStack {
            switch appState.currentMode {
            case .home:
                HomeView().transition(slideTransition)
            case .detail:
                DetailView().transition(slideTransition)
            }
        }
        .onChange(of: appState.currentMode) { oldMode, newMode in
            handleModeChange(from: oldMode, to: newMode)
        }
    }

    private var slideTransition: AnyTransition {
        AnyTransition.asymmetric(
            insertion: .move(edge: appState.navigatingForward ? .trailing : .leading),
            removal: .move(edge: appState.navigatingForward ? .leading : .trailing)
        )
    }
}
```

Navigation helpers on `AppState`:

```swift
func navigate(to mode: AppMode, forward: Bool = true) {
    navigatingForward = forward
    withAnimation(.easeInOut(duration: 0.25)) { currentMode = mode }
}
```

---

## 4. SwiftUI Patterns

### Color Palette

Define as `private let` at the top of view structs:

```swift
private let bgTop = Color(red: 0.07, green: 0.08, blue: 0.12)
private let bgBottom = Color(red: 0.04, green: 0.05, blue: 0.07)
private let cardBg = Color(white: 1, opacity: 0.055)
private let cardBorder = Color(white: 1, opacity: 0.07)
private let accentBlue = Color(red: 0.25, green: 0.55, blue: 1.0)
private let dimText = Color(white: 0.4)
private let bodyText = Color(white: 0.75)
```

### Dark Gradient Background

```swift
ZStack {
    LinearGradient(colors: [bgTop, bgBottom], startPoint: .top, endPoint: .bottom)
        .ignoresSafeArea()
    // Content...
}
.preferredColorScheme(.dark)
```

### Card Style

```swift
content
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .background(cardBg)
    .clipShape(RoundedRectangle(cornerRadius: 14))
    .overlay(RoundedRectangle(cornerRadius: 14).stroke(cardBorder, lineWidth: 0.5))
```

### Capsule Button

```swift
HStack(spacing: 10) {
    Image(systemName: "play.fill").font(.caption)
    Text("Start").font(.body.weight(.semibold))
}
.foregroundColor(.white)
.padding(.horizontal, 44)
.padding(.vertical, 16)
.background(
    Capsule().fill(accentBlue)
        .shadow(color: accentBlue.opacity(0.3), radius: 12, y: 4)
)
```

### Floating Circular Button

```swift
Image(systemName: "gearshape")
    .font(.title3)
    .foregroundColor(dimText)
    .frame(width: 52, height: 52)
    .background(.ultraThinMaterial)
    .clipShape(Circle())
    .overlay(Circle().stroke(cardBorder, lineWidth: 0.5))
```

### Tap vs Long-Press Disambiguation

SwiftUI fires both tap and long press by default. Suppress tap when long press completes:

```swift
struct GestureButton<Label: View>: View {
    let onTap: () -> Void
    let onLongPress: () -> Void
    let label: () -> Label
    @State private var didLongPress = false

    var body: some View {
        label()
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 1.0, perform: {
                didLongPress = true
                onLongPress()
            })
            .simultaneousGesture(
                TapGesture().onEnded {
                    if !didLongPress { onTap() }
                    didLongPress = false
                }
            )
    }
}
```

### Swipe Gesture with Rubber-Band

```swift
@State private var swipeOffset: CGFloat = 0

content
    .offset(x: swipeOffset)
    .gesture(
        DragGesture(minimumDistance: 30)
            .onChanged { value in
                let dx = value.translation.width
                guard dx < 0, abs(value.translation.height) < abs(dx) else { return }
                swipeOffset = dx * 0.4  // Resistance factor
            }
            .onEnded { value in
                if value.translation.width < -80 || value.predictedEndTranslation.width < -200 {
                    // Trigger navigation
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                        swipeOffset = 0
                    }
                }
            }
    )
```

### Toast

```swift
@State private var showToast = false

// In ZStack
if showToast {
    VStack {
        Spacer()
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill").foregroundColor(.green)
            Text("Saved").font(.subheadline.weight(.medium)).foregroundColor(.white)
        }
        .padding(.horizontal, 20).padding(.vertical, 12)
        .background(.ultraThinMaterial)
        .clipShape(Capsule())
        .padding(.bottom, 100)
    }
    .transition(.move(edge: .bottom).combined(with: .opacity))
    .animation(.spring(response: 0.35), value: showToast)
}

// Trigger
showToast = true
DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
    withAnimation { showToast = false }
}
```

### Grid Layout (Photos-Style)

```swift
private let columns = [
    GridItem(.flexible(), spacing: 2),
    GridItem(.flexible(), spacing: 2),
    GridItem(.flexible(), spacing: 2)
]

ScrollView {
    LazyVGrid(columns: columns, spacing: 2) {
        ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
            ThumbnailView(item: item)
                .aspectRatio(1, contentMode: .fit)
                .onTapGesture { selectedIndex = index }
        }
    }
}
```

### Custom Segmented Control

```swift
HStack(spacing: 2) {
    ForEach(Tab.allCases, id: \.self) { tab in
        Button(action: { selectedTab = tab }) {
            HStack(spacing: 5) {
                Image(systemName: tab.icon).font(.caption)
                Text(tab.title).font(.subheadline.weight(.medium))
            }
            .foregroundColor(selectedTab == tab ? .white : dimText)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(selectedTab == tab ? cardBg : .clear)
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }
}
.padding(3)
.background(Color(white: 0.08))
.clipShape(RoundedRectangle(cornerRadius: 10))
```

---

## 5. UIKit Bridging

### When to Use UIKit

Use `UIViewControllerRepresentable` when SwiftUI lacks the control you need:
- **Pinch-to-zoom + paging**: `UIPageViewController` + `UIScrollView` (SwiftUI `TabView(.page)` conflicts with pinch gestures)
- **System pickers**: `PHPickerViewController`, `UIDocumentPickerViewController`
- **Sharing**: `UIActivityViewController`
- **Video playback**: `AVPlayerViewController`

### UIPageViewController

```swift
struct PagedContentView: UIViewControllerRepresentable {
    let items: [Item]
    @Binding var currentIndex: Int

    func makeUIViewController(context: Context) -> UIPageViewController {
        let pvc = UIPageViewController(
            transitionStyle: .scroll,
            navigationOrientation: .horizontal,
            options: [.interPageSpacing: 16]
        )
        pvc.dataSource = context.coordinator
        pvc.delegate = context.coordinator
        if let first = context.coordinator.makeVC(for: currentIndex) {
            pvc.setViewControllers([first], direction: .forward, animated: false)
        }
        return pvc
    }

    func updateUIViewController(_ pvc: UIPageViewController, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, UIPageViewControllerDataSource, UIPageViewControllerDelegate {
        var parent: PagedContentView
        init(_ parent: PagedContentView) { self.parent = parent }

        func makeVC(for index: Int) -> UIViewController? {
            guard parent.items.indices.contains(index) else { return nil }
            let vc = ContentPageVC()
            vc.pageIndex = index
            // Configure vc...
            return vc
        }

        func pageViewController(_ pvc: UIPageViewController, viewControllerBefore vc: UIViewController) -> UIViewController? {
            let idx = (vc as? ContentPageVC)?.pageIndex ?? 0
            return idx > 0 ? makeVC(for: idx - 1) : nil
        }

        func pageViewController(_ pvc: UIPageViewController, viewControllerAfter vc: UIViewController) -> UIViewController? {
            let idx = (vc as? ContentPageVC)?.pageIndex ?? 0
            return idx < parent.items.count - 1 ? makeVC(for: idx + 1) : nil
        }

        func pageViewController(_ pvc: UIPageViewController, didFinishAnimating: Bool, previousViewControllers: [UIViewController], transitionCompleted completed: Bool) {
            guard completed, let vc = pvc.viewControllers?.first as? ContentPageVC else { return }
            parent.currentIndex = vc.pageIndex
        }
    }
}
```

### Pinch-to-Zoom Image Viewer

```swift
class ZoomableImageVC: UIViewController, UIScrollViewDelegate {
    var image: UIImage!
    private let scrollView = UIScrollView()
    private let imageView = UIImageView()

    override func viewDidLoad() {
        super.viewDidLoad()
        scrollView.delegate = self
        scrollView.minimumZoomScale = 1
        scrollView.maximumZoomScale = 6
        scrollView.bouncesZoom = true
        scrollView.contentInsetAdjustmentBehavior = .never
        view.addSubview(scrollView)
        imageView.contentMode = .scaleAspectFit
        scrollView.addSubview(imageView)
        imageView.image = image

        let doubleTap = UITapGestureRecognizer(target: self, action: #selector(handleDoubleTap))
        doubleTap.numberOfTapsRequired = 2
        scrollView.addGestureRecognizer(doubleTap)
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

    func scrollViewDidZoom(_ scrollView: UIScrollView) {
        let ox = max((scrollView.bounds.width - imageView.frame.width) / 2, 0)
        let oy = max((scrollView.bounds.height - imageView.frame.height) / 2, 0)
        imageView.center = CGPoint(x: imageView.frame.width / 2 + ox, y: imageView.frame.height / 2 + oy)
    }

    @objc private func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
        if scrollView.zoomScale > scrollView.minimumZoomScale {
            scrollView.setZoomScale(1, animated: true)
        } else {
            let pt = gesture.location(in: imageView)
            let sz = CGSize(width: scrollView.bounds.width / 3, height: scrollView.bounds.height / 3)
            scrollView.zoom(to: CGRect(x: pt.x - sz.width / 2, y: pt.y - sz.height / 2, width: sz.width, height: sz.height), animated: true)
        }
    }
}
```

### Photo Picker

```swift
import PhotosUI

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.filter = .images
        config.selectionLimit = 1
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ vc: PHPickerViewController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }

    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: ImagePicker
        init(_ parent: ImagePicker) { self.parent = parent }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()
            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else { return }
            provider.loadObject(ofClass: UIImage.self) { image, _ in
                Task { @MainActor [weak self] in
                    self?.parent.image = image as? UIImage
                }
            }
        }
    }
}
```

### Share Sheet

```swift
func shareItems(_ urls: [URL]) {
    let activityVC = UIActivityViewController(activityItems: urls, applicationActivities: nil)
    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
       let rootVC = windowScene.windows.first?.rootViewController {
        rootVC.present(activityVC, animated: true)
    }
}
```

---

## 6. Local File Storage

### Store Pattern with JSON Manifest

```swift
struct MediaItem: Identifiable, Codable {
    let id: UUID
    let filename: String
    let type: ItemType
    let timestamp: Date
}

@MainActor
class ItemStore: ObservableObject {
    @Published var items: [MediaItem] = []

    static var storageDirectory: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        let dir = docs.appendingPathComponent(".storage", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private var manifestURL: URL {
        Self.storageDirectory.appendingPathComponent("manifest.json")
    }

    init() { loadManifest() }

    func save(_ data: Data, filename: String, type: ItemType) {
        let id = UUID()
        let file = "\(type.prefix)_\(id.uuidString).\(type.ext)"
        let url = Self.storageDirectory.appendingPathComponent(file)
        try? data.write(to: url)

        items.insert(MediaItem(id: id, filename: file, type: type, timestamp: Date()), at: 0)
        saveManifest()
    }

    func delete(_ item: MediaItem) {
        let url = Self.storageDirectory.appendingPathComponent(item.filename)
        try? FileManager.default.removeItem(at: url)
        items.removeAll { $0.id == item.id }
        saveManifest()
    }

    private func saveManifest() {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: manifestURL)
    }

    private func loadManifest() {
        guard let data = try? Data(contentsOf: manifestURL),
              let loaded = try? JSONDecoder().decode([MediaItem].self, from: data) else { return }
        // Filter to items whose files still exist on disk
        items = loaded.filter {
            FileManager.default.fileExists(atPath: Self.storageDirectory.appendingPathComponent($0.filename).path)
        }
    }
}
```

**Key patterns:**
- JSON manifest for metadata — faster than scanning filesystem
- Insert new items at front (most recent first)
- On load, validate files still exist on disk
- Naming: `AppName_type_UUID.extension`

### Thumbnail Generation

```swift
extension UIImage {
    func thumbnailImage(maxSize: CGFloat) -> UIImage {
        let scale = min(maxSize / size.width, maxSize / size.height)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        return UIGraphicsImageRenderer(size: newSize).image { _ in
            draw(in: CGRect(origin: .zero, size: newSize))
        }
    }
}

// Video thumbnail from first frame
func videoThumbnail(url: URL) -> UIImage? {
    let generator = AVAssetImageGenerator(asset: AVAsset(url: url))
    generator.appliesPreferredTrackTransform = true
    generator.maximumSize = CGSize(width: 400, height: 400)
    return (try? generator.copyCGImage(at: .zero, actualTime: nil)).map { UIImage(cgImage: $0) }
}
```

---

## 7. Networking

### Multipart Upload

```swift
func upload(fileURL: URL, to baseURL: String) async throws {
    let boundary = UUID().uuidString
    let filename = fileURL.lastPathComponent
    let fileData = try Data(contentsOf: fileURL)

    var body = Data()
    body.appendString("--\(boundary)\r\n")
    body.appendString("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n")
    body.appendString("Content-Type: application/octet-stream\r\n\r\n")
    body.append(fileData)
    body.appendString("\r\n--\(boundary)--\r\n")

    var request = URLRequest(url: URL(string: baseURL + "/upload")!)
    request.httpMethod = "POST"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    request.timeoutInterval = 300
    request.httpBody = body

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
        let msg = String(data: data, encoding: .utf8) ?? "Unknown error"
        throw ServiceError.requestFailed(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0, message: msg)
    }
}

private extension Data {
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) { append(data) }
    }
}
```

### Error Enum Pattern

```swift
enum ServiceError: Error, LocalizedError {
    case noURL
    case invalidURL
    case fileNotFound
    case requestFailed(statusCode: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .noURL: return "URL not configured"
        case .invalidURL: return "Invalid URL"
        case .fileNotFound: return "File not found"
        case .requestFailed(let code, let msg): return "Failed (\(code)): \(msg)"
        }
    }
}
```

### Service with Dependency Injection

```swift
class SomeService {
    private let session: URLSession

    init(session: URLSession = .shared) {
        self.session = session
    }

    func fetchData(from url: URL) async throws -> Data {
        let (data, _) = try await session.data(from: url)
        return data
    }
}
```

---

## 8. Face ID / Biometrics

```swift
import LocalAuthentication

func authenticateWithBiometrics(completion: @escaping (Bool, String?) -> Void) {
    let context = LAContext()
    context.localizedFallbackTitle = ""  // Hide "Enter Password" fallback
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
        completion(false, "Biometric authentication not available")
        return
    }
    context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: "Access protected data") { success, error in
        DispatchQueue.main.async {
            completion(success, error?.localizedDescription)
        }
    }
}
```

---

## 9. Testing

### Framework: Swift Testing (not XCTest)

```swift
import Testing
import UIKit
@testable import MyApp

struct SomeFeatureTests {
    @Test func descriptiveName() {
        let result = someFunction()
        #expect(result == expectedValue)
    }

    @Test func throwingTest() throws {
        let data = try JSONEncoder().encode(someValue)
        let decoded = try JSONDecoder().decode(SomeType.self, from: data)
        #expect(decoded == someValue)
    }
}
```

### @MainActor Tests

Tests that touch `@MainActor` types must be annotated:

```swift
@MainActor
struct AppStateTests {
    @Test func defaultValues() {
        let state = AppState()
        #expect(state.currentMode == .home)
    }
}
```

### Testing Enums

For every enum, test:
1. `allCases` count — catches accidental additions/removals
2. `rawValue` mapping — catches typos
3. `Codable` round-trip
4. Framework type mapping (computed properties)

```swift
@Test func codableRoundTrip() throws {
    for value in SomeEnum.allCases {
        let data = try JSONEncoder().encode(value)
        let decoded = try JSONDecoder().decode(SomeEnum.self, from: data)
        #expect(decoded == value)
    }
}
```

### Testing UserDefaults Persistence

```swift
private func cleanDefaults() {
    for key in ["setting1", "setting2"] {
        UserDefaults.standard.removeObject(forKey: key)
    }
}

@Test func settingsPersistence() {
    cleanDefaults()
    let state = AppState()
    state.someSetting = .newValue

    let state2 = AppState()
    #expect(state2.someSetting == .newValue)
    cleanDefaults()
}

@Test func invalidPersistedValuesUseDefaults() {
    UserDefaults.standard.set("INVALID", forKey: "someSetting")
    let state = AppState()
    #expect(state.someSetting == .defaultValue)
    cleanDefaults()
}
```

### Testing File Operations

```swift
@Test func saveAndDelete() {
    let store = ItemStore()
    let initial = store.items.count
    store.save(testData, filename: "test.txt", type: .document)
    #expect(store.items.count == initial + 1)

    let item = store.items.first!
    let url = ItemStore.storageDirectory.appendingPathComponent(item.filename)
    #expect(FileManager.default.fileExists(atPath: url.path))

    store.delete(item)
    #expect(store.items.count == initial)
    #expect(!FileManager.default.fileExists(atPath: url.path))
}
```

### Testing Async/Network Errors

```swift
@Test func uploadFailsWithEmptyURL() async {
    let service = SomeService()
    do {
        try await service.upload(fileURL: tempFile, to: "")
        #expect(Bool(false), "Expected error")
    } catch let error as ServiceError {
        #expect(error == .noURL)
    } catch {
        #expect(Bool(false), "Wrong error type: \(error)")
    }
}
```

### What You Can't Test in Simulator

- Camera hardware — test guards and state only
- Haptics — calls are silent
- Face ID — test the surrounding flow
- Volume buttons — test handler wiring

---

## 10. Build & Run

### Build

```bash
# Simulator
xcodebuild -project MyApp.xcodeproj -scheme MyApp \
  -destination 'id=SIMULATOR_UUID' build 2>&1 | grep -E "error:|BUILD"

# Device
xcodebuild -project MyApp.xcodeproj -scheme MyApp \
  -destination 'id=DEVICE_UUID' build 2>&1 | grep -E "error:|BUILD"
```

### Test

```bash
xcodebuild test -project MyApp.xcodeproj -scheme MyApp \
  -destination 'id=SIMULATOR_UUID' 2>&1 | tail -30
```

### Simulator Management

```bash
xcrun simctl list devices available          # List simulators
xcrun simctl boot SIMULATOR_UUID             # Boot
xcrun simctl install UUID /path/to/App.app   # Install
xcrun simctl launch UUID com.yourname.myapp  # Launch
xcrun simctl io UUID screenshot /tmp/ss.png  # Screenshot
xcrun simctl terminate UUID com.yourname.myapp
xcrun simctl spawn UUID defaults write com.yourname.myapp key -int 2  # Set UserDefaults
```

---

## 11. CI with GitHub Actions

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: macos-15
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Select Xcode
        run: sudo xcode-select -s /Applications/Xcode_16.2.app/Contents/Developer
      - name: Install XcodeGen
        run: brew install xcodegen
      - name: Generate Xcode project
        run: xcodegen generate
      - name: Build
        run: |
          xcodebuild build \
            -project MyApp.xcodeproj -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
            -configuration Debug \
            CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO \
            | xcpretty --color
      - name: Test
        run: |
          xcodebuild test \
            -project MyApp.xcodeproj -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
            -configuration Debug \
            CODE_SIGN_IDENTITY="" CODE_SIGNING_REQUIRED=NO \
            | xcpretty --color --report junit
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: build/reports/junit.xml
          retention-days: 14
```

**CI notes:**
- `CODE_SIGN_IDENTITY=""` and `CODE_SIGNING_REQUIRED=NO` for CI builds
- Use simulator name (`platform=iOS Simulator,name=iPhone 16 Pro`), not UUID, for CI
- `xcpretty` for readable output

---

## 12. Common Pitfalls

| Problem | Solution |
|---------|----------|
| SwiftUI `TabView(.page)` conflicts with pinch | Use UIKit `UIPageViewController` + `UIScrollView` |
| Edited `.xcodeproj` by hand | Never — regenerate with `xcodegen generate` |
| New file not in build | Run `xcodegen generate` after adding any Swift file |
| Both tap and long press fire on same view | Use `GestureButton` pattern (§4) |
| Screen sleeps during long task | `UIApplication.shared.isIdleTimerDisabled = true` |
| App state leaks on background | Reset in `willResignActiveNotification` handler |

---

## 13. Checklists

### New Swift File
1. Create in `MyApp/` or `MyAppTests/`
2. Run `xcodegen generate`
3. Build to verify

### New Setting
1. Add `@Published` + `didSet` to `AppState`
2. Load in `AppState.init()` with fallback
3. Add UI in settings view
4. Write tests: default, persistence, invalid value fallback

### New Enum
1. Choose raw value type (`String`/`Int`)
2. Conform to `CaseIterable, Codable, Identifiable`
3. Add framework mapping computed property if needed
4. Write tests: allCases count, rawValues, codable round-trip

### New Network Service
1. Create with `URLSession` dependency injection
2. Define error enum: `Error, LocalizedError`
3. Use `async throws`
4. Test error paths (empty URL, missing file, bad response)
