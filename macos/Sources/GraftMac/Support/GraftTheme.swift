import SwiftUI

enum GraftTheme {
    static let green = Color(red: 0.55, green: 0.86, blue: 0.29)
    static let navy = Color(red: 0.06, green: 0.09, blue: 0.16)
}

struct GraftBrandView: View {
    var subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            GraftAppIcon(size: 42)
            VStack(alignment: .leading, spacing: 2) {
                Text("Graft").font(.title2.weight(.semibold))
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
