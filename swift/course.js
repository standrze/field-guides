const COURSE = [
  {
    id: "welcome", group: "Start here", title: "Start where Swift Basics ends", time: "7 min", level: "Prerequisite",
    summary: "Confirm the prerequisite boundary, then focus entirely on SwiftTUI view trees, interaction, terminal behavior, and rendering.",
    body: `
      <p class="eyebrow">00 · Course boundary</p><h1>Terminal UI starts here.</h1>
      <p class="lede">This specialization assumes you already know enough Swift to build and test an executable. It teaches the interface layer: views, terminal-cell layout, state identity, focus, controls, lifecycle, rendering, and interaction architecture.</p>
      <div class="lesson-meta"><span>◷ 7 MIN</span><span>◇ SWIFTTUI SPECIALIZATION</span><span>PINNED · 0.9.7</span></div>
      <div class="callout warning"><strong>Prerequisite</strong><p>If values, optionals, functions, protocols, errors, SwiftPM, structured concurrency, or testing are unfamiliar, complete those lessons in the <a href="../swift-basics/">Swift CLI &amp; Networking Basics guide</a> first. Its files and HTTP lessons are needed only when your chosen data store crosses those boundaries. None of these subjects is retaught here.</p></div>
      <h2>The two-course contract</h2>
      <div class="concept-grid">
        <div class="concept-card"><code>Swift Basics owns</code><p>The language, packages, commands, files, processes, networking, observability, security, and general test design.</p></div>
        <div class="concept-card"><code>SwiftTUI owns</code><p>View composition, cell layout, identity, bindings, focus, controls, terminal lifecycle, overlays, semantics, rendering, and frame performance.</p></div>
      </div>
      <h2>The core idea</h2>
      <p>A traditional terminal program prints lines and exits. A TUI stays alive. SwiftTUI repeatedly derives a screen from state:</p>
      <pre><code>state ──► view tree ──► layout ──► terminal cells
  ▲                                      │
  └──────────── keyboard / mouse ────────┘</code></pre>
      <p>You describe <em>what</em> the interface should be for the current state. SwiftTUI owns input, focus, layout, redraw, and terminal restoration.</p>
      <h2>The destination</h2>
      <p>You will finish with <strong>TaskDeck</strong>, a keyboard-driven task board with responsive layout, explicit focus, overlays, asynchronous view lifetimes, accessible fallbacks, and deterministic render tests. The project is deliberately different from the noninteractive <code>pulse</code> health-check command in Swift Basics.</p>
      <h2>Course sequence</h2>
      <ol><li>Launch the supported <code>App</code> and <code>Scene</code> structure.</li><li>Compose terminal layouts and preserve view identity.</li><li>Own state, bindings, selection, and focus.</li><li>Use controls and terminal lifecycle APIs.</li><li>Bind asynchronous effects to view lifetime.</li><li>Design routes, commands, and overlays.</li><li>Test semantics and rendered cells before shipping TaskDeck.</li></ol>
      <div class="callout"><strong>Research snapshot · August 26, 2026</strong><p>The examples target SwiftTUI 0.9.7 and Swift 6.3+. Keep the dependency on the 0.9 minor line and review its changelog before updating.</p></div>`
  },
  {
    id: "first-tui", group: "SwiftTUI runtime", title: "Your first terminal app", time: "24 min", level: "Beginner",
    summary: "Install the current SwiftTUI package and build the supported @main, App, Scene, and WindowGroup structure.",
    body: `
      <p class="eyebrow">01 · SwiftTUI runtime</p><h1>Put a live view in the terminal.</h1><p class="lede">SwiftTUI uses SwiftUI-shaped declarations, but renders terminal cells and runs as a normal command-line executable.</p>
      <div class="lesson-meta"><span>◷ 24 MIN</span><span>◇ SWIFTTUI BASICS</span></div>
      <h2>Create the package</h2><div class="terminal"><div class="terminal-bar"><i></i><i></i><i></i><span>shell</span></div><pre><code><span class="prompt">$</span> mkdir counter && cd counter
<span class="prompt">$</span> swift package init --type executable</code></pre></div>
      <p>In <code>Package.swift</code>, add the dependency and target product:</p>
      <pre><span class="code-label">Package.swift · relevant sections</span><code>dependencies: [
  .package(
    url: "https://github.com/SwiftTUI/swift-tui",
    .upToNextMinor(from: "0.9.7")
  )
],
targets: [
  .executableTarget(
    name: "counter",
    dependencies: [
      .product(name: "SwiftTUI", package: "swift-tui")
    ]
  )
]</code></pre>
      <h2>The complete app</h2><pre><code>import SwiftTUI

struct CounterView: View {
  @State private var count = 0

  var body: some View {
    VStack(spacing: 1) {
      TextFigure("\\(count)", font: .future)
        .frame(minWidth: 14, alignment: .center)
      Button("Increment") { count += 1 }
        .buttonStyle(.bordered)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

@main
struct CounterApp: App {
  var body: some Scene {
    WindowGroup("Counter") { CounterView() }
  }
}</code></pre>
      <div class="terminal"><div class="terminal-bar"><i></i><i></i><i></i><span>shell</span></div><pre><code><span class="prompt">$</span> swift run
# Space activates the focused button. Ctrl-C exits.</code></pre></div>
      <div class="callout warning"><strong>Current API</strong><p>Use <code>@main</code>. Do not call <code>MyApp.main()</code> yourself, and do not follow old tutorials using <code>Application(rootView:).start()</code>; that belongs to a different, older project.</p></div>
      <div class="lab"><span class="lab-tag">Lab 01</span><h3>Counter, then decrement</h3><p>Run the example, add a decrement button, and display a message when the count reaches zero.</p></div>`
  },
  {
    id: "views-layout", group: "Build with SwiftTUI", title: "Views, layout & modifiers", time: "35 min", level: "Intermediate",
    summary: "Compose stacks, frames, text, sections, groups, scrollable content, styles, and responsive terminal layouts.",
    body: `
      <p class="eyebrow">02 · Views &amp; layout</p><h1>Compose screens from small views.</h1><p class="lede">A view is a value that describes UI. Its <code>body</code> returns another view; result builders let branches and collections become one typed tree.</p>
      <div class="lesson-meta"><span>◷ 35 MIN</span><span>◇ INTERMEDIATE</span></div>
      <h2>Extract reusable views</h2><pre><code>struct StatCard: View {
  let label: String
  let value: Int

  var body: some View {
    VStack(alignment: .leading) {
      Text(label).foregroundStyle(.secondary)
      Text("\\(value)").bold()
    }
    .padding(1)
    .frame(minWidth: 16, alignment: .leading)
    .border(.green)
  }
}</code></pre>
      <h2>Layout is proposed, measured, then placed</h2><p>Parents propose a cell size. Children report sizes; parents place them. Text wrapping and terminal width matter more than pixel geometry.</p>
      <pre><code>VStack(alignment: .leading, spacing: 1) {
  Text("TASKDECK").bold()
  HStack(spacing: 2) {
    StatCard(label: "Open", value: openCount)
    StatCard(label: "Done", value: doneCount)
  }
  Divider()
  ScrollView { taskRows }
}
.padding(1)
.frame(maxWidth: .infinity, maxHeight: .infinity,
       alignment: .topLeading)</code></pre>
      <h2>Identity matters</h2><p>SwiftTUI associates state with structural position. For dynamic collections, provide stable identifiers:</p>
      <pre><code>ForEach(tasks) { task in
  TaskRow(task: task)
}

// Avoid using an array index as identity if items can reorder.</code></pre>
      <div class="callout"><strong>Terminal design</strong><p>Design for narrow widths, keyboard use, monochrome output, and text that remains understandable without decoration. Color should reinforce meaning, not carry it alone.</p></div>
      <div class="lab"><span class="lab-tag">Lab 02</span><h3>TaskDeck dashboard shell</h3><p>Create a header, two stat cards, a divider, and a scrollable list of sample tasks. Resize the terminal until it breaks, then simplify the layout.</p></div>`
  },
  {
    id: "state-focus", group: "Build with SwiftTUI", title: "State, bindings & focus", time: "42 min", level: "Intermediate",
    summary: "Own local state, project bindings, model focus, route keyboard interaction, and avoid state identity traps.",
    body: `
      <p class="eyebrow">03 · State &amp; focus</p><h1>State drives every frame.</h1><p class="lede">When state changes, SwiftTUI invalidates affected identities and produces a new terminal frame. You should never manually redraw.</p>
      <div class="lesson-meta"><span>◷ 42 MIN</span><span>◇ INTERMEDIATE</span></div>
      <h2>Own and borrow</h2><pre><code>struct TaskEditor: View {
  @Binding var title: String

  var body: some View {
    TextField("Task title", text: $title)
  }
}

struct Dashboard: View {
  @State private var draft = ""

  var body: some View {
    TaskEditor(title: $draft)
  }
}</code></pre>
      <p><code>@State</code> owns a local value. <code>@Binding</code> gives a child read/write access without transferring ownership. The <code>$</code> projection creates the binding.</p>
      <h2>Keyboard-first focus</h2><pre><code>enum Field: Hashable { case search, newTask }

struct Dashboard: View {
  @State private var query = ""
  @State private var draft = ""
  @FocusState private var focusedField: Field?

  var body: some View {
    VStack {
      TextField("Search", text: $query)
        .focused($focusedField, equals: .search)
      TextField("New task", text: $draft)
        .focused($focusedField, equals: .newTask)
    }
    .defaultFocus($focusedField, .search)
  }
}</code></pre>
      <h2>Choose the right state home</h2><ul><li><strong>Local visual state:</strong> <code>@State</code>.</li><li><strong>Child edits parent value:</strong> <code>@Binding</code>.</li><li><strong>Shared observable reference model:</strong> Observation plus SwiftTUI's <code>@Bindable</code>.</li><li><strong>Configuration descending through many views:</strong> <code>@Environment</code>.</li><li><strong>Focused subtree exports commands/data:</strong> focused values and bindings.</li></ul>
      <div class="callout warning"><strong>Identity trap</strong><p>Conditional branches and changing <code>.id(...)</code> values can create new state owners. Hoist state above a branch when it must survive that structural change.</p></div>
      <div class="lab"><span class="lab-tag">Lab 03</span><h3>Search and add</h3><p>Add two focused text fields to TaskDeck. Filter rows as the query changes. Submit a nonempty draft, clear it, then return focus to the new-task field.</p></div>`
  },
  {
    id: "controls-events", group: "Build with SwiftTUI", title: "Controls, keys & terminal behavior", time: "36 min", level: "Intermediate",
    summary: "Use lists, tables, buttons, toggles, pickers, key handlers, termination, accessibility flags, and shell handoffs.",
    body: `
      <p class="eyebrow">04 · Controls &amp; terminal</p><h1>Make interaction discoverable.</h1><p class="lede">A terminal interface succeeds when users can navigate it without guessing. Prefer standard controls, visible shortcuts, and a status line.</p>
      <div class="lesson-meta"><span>◷ 36 MIN</span><span>◇ INTERMEDIATE</span></div>
      <h2>Controls before custom event code</h2><p>SwiftTUI includes buttons, toggles, steppers, sliders, pickers, disclosure groups, text fields, lists, tables, scroll views, sections, and outline groups. Built-ins already participate in focus and semantics.</p>
      <pre><code>List(selection: $selectedTaskID) {
  ForEach(filteredTasks) { task in
    Label(task.title, systemImage: task.isDone ? "checkmark" : "circle")
      .tag(task.id)
  }
}

HStack {
  Button("Complete") { completeSelection() }
  Button("Delete") { deleteSelection() }
  Spacer()
  Text("↑↓ move  space activate  / search  q quit")
    .foregroundStyle(.secondary)
}</code></pre>
      <h2>Quit through the environment</h2><pre><code>struct QuitButton: View {
  @Environment(\.requestTermination) private var requestTermination

  var body: some View {
    Button("Quit") { _ = requestTermination() }
  }
}</code></pre>
      <p><code>Ctrl-C</code> exits by default and restores the shell. A scene can replace exit bindings, and <code>onTerminationRequest</code> can veto termination to confirm unsaved changes.</p>
      <h2>Built-in runtime modes</h2><div class="terminal"><div class="terminal-bar"><i></i><i></i><i></i><span>shell</span></div><pre><code><span class="prompt">$</span> swift run taskdeck --no-color
<span class="prompt">$</span> swift run taskdeck --ascii
<span class="prompt">$</span> swift run taskdeck --accessible
<span class="prompt">$</span> swift run taskdeck --cursor-follows-focus
<span class="prompt">$</span> swift run taskdeck --reduce-motion</code></pre></div>
      <p>When launching an editor, pager, or shell command, use SwiftTUI's terminal handoff environment action so the runtime temporarily restores the user's terminal and safely reclaims it afterward.</p>
      <div class="lab"><span class="lab-tag">Lab 04</span><h3>Interaction pass</h3><p>Add selection, complete/delete actions, a shortcut legend, a quit action, and a confirmation path for unsaved edits. Verify the screen in <code>--no-color</code> and <code>--ascii</code> modes.</p></div>`
  },
  {
    id: "async-architecture", group: "Architecture", title: "Bind async work to view lifetime", time: "40 min", level: "Advanced",
    summary: "Connect an existing async boundary to observable UI state, cancellation, loading feedback, and SwiftTUI view lifetime.",
    body: `
      <p class="eyebrow">05 · Architecture</p><h1>Bind work to the view that needs it.</h1><p class="lede">Advanced TUI code stays comprehensible when the view describes presentation and a model owns domain state and effects.</p>
      <div class="lesson-meta"><span>◷ 40 MIN</span><span>◇ ADVANCED</span><span>UI LIFETIME</span></div>
      <div class="callout"><strong>Prerequisite seam</strong><p>This lesson consumes an async <code>TaskStore</code> and typed loading state; Swift Basics owns how protocols, files, HTTP clients, actors, and cancellation are implemented. Here the question is how their results enter and leave the SwiftTUI view tree.</p></div>
      <h2>An observable feature model</h2><pre><code>import Observation

@MainActor
@Observable
final class DashboardModel {
  private(set) var state: LoadState&lt;[Task]&gt; = .idle
  var query = ""
  private let store: any TaskStore

  init(store: any TaskStore) { self.store = store }

  func load() async {
    state = .loading
    do { state = .loaded(try await store.load()) }
    catch is CancellationError { return }
    catch { state = .failed(message: String(describing: error)) }
  }
}</code></pre>
      <h2>Bind lifetime to the view</h2><pre><code>struct DashboardView: View {
  @State private var model: DashboardModel

  init(store: any TaskStore) {
    _model = State(initialValue: DashboardModel(store: store))
  }

  var body: some View {
    content
      .task { await model.load() }
  }

  @ViewBuilder private var content: some View {
    switch model.state {
    case .idle, .loading: ProgressView("Loading tasks…")
    case .failed(let message): ErrorView(message: message)
    case .loaded(let tasks): TaskList(tasks: tasks)
    }
  }
}</code></pre>
      <p>A SwiftTUI <code>.task</code> inherits actor context and is reconciled with view lifetime. Treat cancellation as a normal control-flow event, not a user-facing error.</p>
      <h2>Architecture guardrails</h2><ul><li>Keep filtering and sorting pure.</li><li>Do not perform I/O from <code>body</code>.</li><li>Keep source-of-truth ownership above views that merely edit or display it.</li><li>Use stable IDs for domain entities.</li><li>Represent idle/loading/success/failure explicitly.</li><li>Batch or debounce expensive work triggered by rapid keystrokes.</li></ul>
      <div class="lab"><span class="lab-tag">Lab 05</span><h3>Connect an existing store</h3><p>Replace TaskDeck's sample array with a store built outside the UI layer. Show loading and failure states, offer Retry, and save after edits without blocking keyboard input.</p></div>`
  },
  {
    id: "advanced-patterns", group: "Architecture", title: "Navigation, commands & overlays", time: "38 min", level: "Advanced",
    summary: "Model routes and temporary surfaces explicitly, preserve focus, and give keyboard commands a predictable priority order.",
    body: `
      <p class="eyebrow">06 · Architecture</p><h1>Make every interaction land somewhere explicit.</h1><p class="lede">A terminal app has one keyboard and limited screen space. Model navigation, overlays, selection, and commands as UI state so input never depends on hidden global handlers.</p>
      <div class="lesson-meta"><span>◷ 38 MIN</span><span>◇ ADVANCED</span><span>ROUTES · COMMANDS · OVERLAYS</span></div>
      <h2>Separate durable route from temporary presentation</h2><pre><code>enum Route: Equatable {
  case board
  case details(Task.ID)
  case settings
}

enum Overlay: Equatable {
  case help
  case commandPalette
  case confirmDelete(Task.ID)
}

struct InterfaceState: Equatable {
  var route: Route = .board
  var overlay: Overlay?
  var selectedTaskID: Task.ID?
}</code></pre>
      <p>The route answers “which workspace is active?” The overlay answers “what temporarily sits above it?” Keeping them separate prevents a help panel or confirmation prompt from destroying the underlying selection.</p>
      <h2>Render one state tree</h2><pre><code>@ViewBuilder
var content: some View {
  switch interface.route {
  case .board:
    BoardView(selection: $interface.selectedTaskID)
  case .details(let id):
    TaskDetailsView(taskID: id)
  case .settings:
    SettingsView()
  }
}

var body: some View {
  content
    .overlay { overlayContent }
}</code></pre>
      <p>Keep the route switch close to the composition root. Leaf views should request navigation through a narrow action or binding rather than reaching into a global router.</p>
      <h2>Define input priority</h2><ol><li>The focused control handles editing and activation.</li><li>An active confirmation or palette handles its own commands.</li><li>The current route handles screen-level shortcuts.</li><li>The app handles truly global actions such as Help or Quit.</li></ol>
      <p>A broad key handler at the root can steal arrows, Escape, or text from a focused control. Prefer built-in controls and focused command routing; promote a shortcut to global scope only when it is valid everywhere.</p>
      <h2>Restore focus deliberately</h2><p>When an overlay opens, record the logical focus destination—not an index into the current rows. When it closes, restore focus only if that destination still exists. Deleting or filtering a selected item should choose a deterministic neighbor before the next frame.</p>
      <h2>Design the command palette as data</h2><pre><code>struct Command: Identifiable {
  let id: String
  let title: String
  let shortcut: String?
  let isAvailable: (InterfaceState) -&gt; Bool
  let perform: () -&gt; Void
}</code></pre>
      <p>The visible palette, shortcut legend, and help overlay should come from the same command definitions. This keeps discoverability and execution in sync.</p>
      <div class="callout warning"><strong>Terminal rule</strong><p>Escape should close the topmost temporary surface before it navigates away or quits. Show the active mode and available exit in text; never rely on color alone.</p></div>
      <div class="lab"><span class="lab-tag">Lab 06</span><h3>Add TaskDeck navigation</h3><ul class="checklist"><li>Add board, details, and settings routes.</li><li>Add Help and Confirm Delete overlays without losing board selection.</li><li>Give Escape a strict topmost-first behavior.</li><li>Generate the footer legend and command palette from one command list.</li><li>Test route and focus restoration after deleting the selected row.</li></ul></div>`
  },
  {
    id: "rendering-tests", group: "Quality", title: "Rendering, semantics & frame performance", time: "38 min", level: "Advanced",
    summary: "Understand the rendering pipeline, make deterministic snapshots, test behavior, and diagnose expensive frames.",
    body: `
      <p class="eyebrow">07 · Quality</p><h1>Test cells, not screenshots.</h1><p class="lede">SwiftTUI's deterministic cell pipeline makes interfaces inspectable without a TTY: resolve, measure, place, semantics, draw, raster, commit.</p>
      <div class="lesson-meta"><span>◷ 38 MIN</span><span>◇ ADVANCED</span></div>
      <h2>Two interface-specific test layers</h2><ol><li><strong>View render tests:</strong> fixed-size textual frames, raster structure, and semantics.</li><li><strong>Runtime interaction tests:</strong> input, focus, invalidation, and lifecycle through the live run loop.</li></ol>
      <p>Keep domain policy, stores, and adapter tests in the Swift Basics-owned modules. This course consumes those tested boundaries and adds evidence only for the SwiftTUI layer.</p>
      <pre><code>import SwiftTUI

@MainActor
func preview() throws {
  // A committed, noninteractive render useful for previews and snapshots.
  RenderOnce.print(TaskDeckPreview(), width: 80)
}</code></pre>
      <p>The framework's lower-level <code>DefaultRenderer</code> exposes render snapshots, raster surfaces, semantics, reuse diagnostics, and timing. Use it when a plain textual preview is not enough.</p>
      <h2>Performance checklist</h2><ul><li>Profile before optimizing; frame diagnostics separate main-actor blockage, suspension, worker time, and pipeline phases.</li><li>Move expensive parsing and I/O away from the main actor.</li><li>Avoid unstable IDs that rebuild stateful subtrees.</li><li>Do not erase views to <code>AnyView</code> unless heterogeneous storage truly requires it.</li><li>Use built-in lazy or scrollable containers for large collections.</li><li>Keep custom <code>Layout</code> caches value-semantic and derived from subviews.</li></ul>
      <div class="callout"><strong>Accessibility is testable structure</strong><p>Semantics are a pipeline output, not decoration. Check labels, focus, selected state, and action meaning alongside raster output.</p></div>
      <div class="lab"><span class="lab-tag">Lab 07</span><h3>Prove TaskDeck</h3><p>Create fixed 40- and 80-column renders for empty, loaded, filtered, and failed states. Add one live interaction test that moves focus and activates a task.</p></div>`
  },
  {
    id: "capstone", group: "Quality", title: "Capstone: TaskDeck", time: "2–4 hr", level: "Project",
    summary: "Assemble a polished, testable task dashboard and define stretch goals that deepen real terminal engineering skills.",
    body: `
      <p class="eyebrow">08 · Capstone</p><h1>Ship TaskDeck.</h1><p class="lede">Bring the interface course together in a keyboard-first terminal application. The domain and storage boundaries are prerequisites; this capstone is judged on interaction, focus, layout, lifecycle, semantics, and rendered evidence.</p>
      <div class="lesson-meta"><span>◷ 2–4 HOURS</span><span>◇ CAPSTONE</span></div>
      <h2>Required behavior</h2><ul class="checklist"><li>Load and save through an injected <code>TaskStore</code>; implement and test the adapter outside this UI course.</li><li>Show open/done counts and a filterable task list.</li><li>Add, complete, and delete tasks entirely from the keyboard.</li><li>Keep selection valid when filtering or deleting.</li><li>Show loading, empty, success, and actionable error states.</li><li>Confirm termination when edits are unsaved.</li><li>Work at 40 and 80 columns, with <code>--ascii</code> and <code>--no-color</code>.</li><li>Reuse prerequisite domain tests; add deterministic SwiftTUI render, semantics, and interaction coverage.</li></ul>
      <h2>Suggested state</h2><pre><code>struct DashboardState {
  var tasks: [Task] = []
  var query = ""
  var selectedID: Task.ID?
  var draft = ""
  var filter: Filter = .open
  var phase: Phase = .idle
  var hasUnsavedChanges = false
}</code></pre>
      <h2>Build order</h2><ol><li>Import the existing task model and pure filtering boundary.</li><li>Compose a static dashboard around an in-memory store.</li><li>Add focus, selection, and editing.</li><li>Connect an existing <code>TaskStore</code> and map async work into UI phases.</li><li>Add error, overlay, and termination flows.</li><li>Prove renders, semantics, interactions, accessibility modes, and the release build.</li></ol>
      <h2>Stretch goals</h2><div class="concept-grid"><div class="concept-card"><code>Command palette</code><p>Fuzzy-search commands and route them through focused values.</p></div><div class="concept-card"><code>Undo / redo</code><p>Model edits as value-semantic commands with inverse operations.</p></div><div class="concept-card"><code>Shell handoff</code><p>Open the selected task in <code>$EDITOR</code> while safely yielding the terminal.</p></div><div class="concept-card"><code>Large data</code><p>Load thousands of tasks, measure frames, then remove proven bottlenecks.</p></div></div>
      <h2>Release it</h2><div class="terminal"><div class="terminal-bar"><i></i><i></i><i></i><span>shell</span></div><pre><code><span class="prompt">$</span> swift test
<span class="prompt">$</span> swift build -c release
<span class="prompt">$</span> .build/release/taskdeck --ascii</code></pre></div>
      <div class="callout warning"><strong>Pre-1.0 dependency</strong><p>SwiftTUI 0.9.7 is beta. Keep <code>.upToNextMinor</code>, commit <code>Package.resolved</code> for an app, read the changelog before updating, and rerun your render tests.</p></div>`
  },
  {
    id: "reference", group: "Reference", title: "SwiftTUI field notes", time: "10 min", level: "Reference",
    summary: "Keep the SwiftTUI ownership map, runtime modes, debugging sequence, and course boundary beside the terminal.",
    body: `
      <p class="eyebrow">09 · Reference</p><h1>Debug the interface layer.</h1><p class="lede">Use this page when a view, focus route, terminal mode, or frame behaves differently from the state you expected.</p>
      <div class="lesson-meta"><span>◷ 10 MIN</span><span>◇ REFERENCE</span><span>SWIFTTUI 0.9.7</span></div>
      <h2>State ownership map</h2><div class="concept-grid"><div class="concept-card"><code>@State</code><p>Local owned value tied to stable view identity.</p></div><div class="concept-card"><code>@Binding</code><p>Read/write projection into state owned by an ancestor.</p></div><div class="concept-card"><code>@FocusState</code><p>Authored focus destination and keyboard routing.</p></div><div class="concept-card"><code>@Environment</code><p>Host configuration or lifecycle action flowing down the tree.</p></div></div>
      <h2>Runtime modes worth checking</h2><pre><code>swift run taskdeck --ascii
swift run taskdeck --no-color
swift run taskdeck --accessible
swift run taskdeck --cursor-follows-focus
swift run taskdeck --reduce-motion
swift run taskdeck --web</code></pre>
      <p>The first five expose terminal and accessibility assumptions. The WebHost mode exercises the same authored view tree through a different host; it is useful for catching behavior that was accidentally coupled to one terminal surface.</p>
      <h2>Debugging sequence</h2><ol><li>Freeze one deterministic data and interface state.</li><li>Render at a fixed 40- or 80-column width without a TTY.</li><li>Check structural identity before blaming state storage.</li><li>Check the active overlay and intended focus destination.</li><li>Verify that no I/O or parsing runs from <code>body</code>.</li><li>Inspect semantics and raster output, then test the live input path.</li></ol>
      <h2>The boundary stays firm</h2><p>This guide does not reteach Swift syntax, SwiftPM architecture, ArgumentParser, files, subprocesses, HTTP, OpenAPI, telemetry, cryptography, or general testing. Those remain in the local <a href="../swift-basics/">Swift CLI &amp; Networking Basics guide</a>. Here, testing means SwiftTUI render, semantics, focus, and runtime interaction evidence.</p>
      <div class="callout"><strong>Version discipline</strong><p>Read the resolved SwiftTUI package's DocC and changelog beside the code you actually build. Before moving away from 0.9.7, rerun the fixed-width render and interaction suite.</p></div>`
  }
];
