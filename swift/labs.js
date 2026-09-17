const LABS = {
  "advanced-patterns": {
    id: "interface-state",
    title: "Close the topmost interface layer",
    brief: "Implement Escape so it dismisses an overlay first, then returns a detail route to the board, and finally leaves the board unchanged.",
    expected: `details none
board none
board none`,
    hint: "Check and clear overlay before switching on route. Only the details route moves back to board.",
    starter: `enum Route: String {
  case board, details
}

enum Overlay: String {
  case help, confirmDelete
}

struct InterfaceState {
  var route: Route
  var overlay: Overlay?
}

func escape(_ state: inout InterfaceState) {
  // Dismiss the topmost layer first.
}

func describe(_ state: InterfaceState) {
  print("\\(state.route.rawValue) \\(state.overlay?.rawValue ?? \"none\")")
}

var state = InterfaceState(route: .details, overlay: .help)
escape(&state)
describe(state)
escape(&state)
describe(state)
escape(&state)
describe(state)`
  }
};
