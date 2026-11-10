# Bendable attribution

Graft's lid animation engine derives from [Bendable](https://github.com/opensourcevillain/Bendable), commit `05c6d2c9f682677c8dae59019bad4dc95869df37`, under the MIT license in BENDABLE-LICENSE.

The sensor, state machine, rendering, previews, and their tests are retained in GraftBend. Graft adds a settings facade, opt-in lifecycle, namespaced preferences, and SwiftPM shader loading. The upstream standalone app and menu are not included.

Graft also cancels previews on display sleep and screen lock, and prevents cancelled preview tasks from drawing another frame.
