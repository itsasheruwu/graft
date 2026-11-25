import SwiftUI

/// The maps and their annotations share one projection. A lyric can bring the map
/// on screen mid-word without a tile request or access to the listener’s location.
struct ScenePlaceChart: View {
    let place: MusicSceneLyricScore.Motif
    let elapsed: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showAttribution = false

    private static let plates: [MusicSceneLyricScore.Motif: NSImage] = {
        let files: [(MusicSceneLyricScore.Motif, String)] = [
            (.asheville, "asheville"), (.eastRiver, "east-river"), (.brooklynBridge, "brooklyn-bridge"),
        ]
        return Dictionary(uniqueKeysWithValues: files.compactMap { motif, name in
            guard let url = Bundle.module.url(forResource: name, withExtension: "png", subdirectory: "MusicSceneMaps"),
                  let image = NSImage(contentsOf: url) else { return nil }
            return (motif, image)
        })
    }()

    // Points sampled from the mapped roads into Pack Square. Zero is the top of the plate.
    private static let ashevilleRoute: [CGPoint] = [
        .init(x: 0.315, y: 0.190), .init(x: 0.368, y: 0.421), .init(x: 0.400, y: 0.552),
        .init(x: 0.412, y: 0.541), .init(x: 0.599, y: 0.429), .init(x: 0.687, y: 0.380),
        .init(x: 0.698, y: 0.377), .init(x: 0.700, y: 0.402), .init(x: 0.713, y: 0.523),
        .init(x: 0.780, y: 0.485), .init(x: 0.797, y: 0.476), .init(x: 0.806, y: 0.479),
        .init(x: 0.811, y: 0.487), .init(x: 0.823, y: 0.535),
    ]
    private let blue = Color(red: 0.08, green: 0.54, blue: 1)

    var body: some View {
        Canvas { context, size in
            let age = reduceMotion ? 1 : min(1, max(0, elapsed))
            let settled = CGFloat(1 - pow(1 - age, 3))
            let scale = max(size.width / 960, size.height / 416) * (1 + 0.081 * (1 - settled))
            let bounds = CGRect(x: (size.width - 960 * scale) / 2 - (1 - settled) * 3,
                                y: (size.height - 416 * scale) / 2,
                                width: 960 * scale, height: 416 * scale)
            if let image = Self.plates[place] {
                context.draw(Image(nsImage: image).interpolation(.high), in: bounds)
            }
            func project(_ point: CGPoint) -> CGPoint {
                CGPoint(x: bounds.minX + bounds.width * point.x, y: bounds.minY + bounds.height * point.y)
            }
            switch place {
            case .asheville:
                let points = Self.ashevilleRoute.map(project)
                var road = Path()
                road.addLines(points)
                let revealed = road.trimmedPath(from: 0, to: 0.10 + settled * 0.90)
                let style = StrokeStyle(lineWidth: 3.5, lineCap: .round, lineJoin: .round)
                context.stroke(revealed, with: .color(.black.opacity(0.58)),
                               style: StrokeStyle(lineWidth: 5, lineCap: .round, lineJoin: .round))
                context.stroke(revealed, with: .color(blue), style: style)
                if let marker = road.trimmedPath(from: 0, to: 0.09 + 0.52 * settled).currentPoint {
                    positionDot(at: marker, age: age, in: context)
                }
                if let destination = points.last { pin(at: destination, bridge: false, age: age, in: context) }
            case .brooklynBridge:
                pin(at: project(.init(x: 0.492, y: 0.494)), bridge: true, age: age, in: context)
            case .eastRiver:
                positionDot(at: project(.init(x: 0.50, y: 0.50)), age: age, in: context)
            default: break
            }
        }
        .background(Color(red: 0.15, green: 0.19, blue: 0.28))
        .overlay(alignment: .bottomLeading) {
            Button {
                showAttribution.toggle()
            } label: {
                Text("© OpenStreetMap")
                    .font(.system(size: 8, weight: .medium))
                    .foregroundStyle(.white.opacity(0.95)).padding(.horizontal, 4).padding(.vertical, 2)
                    .background(.black.opacity(0.5), in: RoundedRectangle(cornerRadius: 3))
            }
            .buttonStyle(.plain).padding(4)
            .accessibilityLabel("Map credits")
            .popover(isPresented: $showAttribution) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("Map credits").font(.headline)
                    Link("© OpenStreetMap contributors", destination: URL(string: "https://www.openstreetmap.org/copyright")!)
                    Link("© OpenMapTiles", destination: URL(string: "https://openmaptiles.org/")!)
                    Link("OpenFreeMap", destination: URL(string: "https://openfreemap.org/")!)
                }
                .padding(15)
            }
        }
    }

    private func positionDot(at point: CGPoint, age: Double, in context: GraphicsContext) {
        var layer = context
        layer.translateBy(x: point.x, y: point.y)
        let ring = 7 + 11 * age
        let circle = Path(ellipseIn: CGRect(x: -ring, y: -ring, width: 2 * ring, height: 2 * ring))
        layer.fill(circle, with: .color(blue.opacity(0.16)))
        layer.stroke(circle, with: .color(blue.opacity(0.68 - 0.35 * age)), lineWidth: 0.8)
        let core = Path(ellipseIn: CGRect(x: -4.8, y: -4.8, width: 9.6, height: 9.6))
        layer.fill(core, with: .color(blue))
        layer.stroke(core, with: .color(.white), lineWidth: 1.8)
    }

    private func pin(at point: CGPoint, bridge: Bool, age: Double, in context: GraphicsContext) {
        var layer = context
        layer.translateBy(x: point.x, y: point.y)
        let settle = reduceMotion ? 1 : 1 - 0.52 * exp(-7.5 * age) * cos(13 * age)
        layer.scaleBy(x: settle, y: settle)
        var body = Path()
        body.move(to: .zero)
        body.addQuadCurve(to: .init(x: -9, y: -15), control: .init(x: -9, y: -10))
        body.addArc(center: .init(x: 0, y: -15), radius: 9, startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
        body.addQuadCurve(to: .zero, control: .init(x: 9, y: -10))
        body.closeSubpath()
        layer.drawLayer { shadow in
            shadow.addFilter(.shadow(color: .black.opacity(0.55), radius: 2, y: 1.4))
            shadow.fill(body, with: .color(bridge ? Color(red: 0.50, green: 0.50, blue: 0.70) : Color(red: 1, green: 0.27, blue: 0.32)))
        }
        layer.stroke(body, with: .color(.white.opacity(0.34)), lineWidth: 0.65)
        if bridge {
            var span = Path()
            for x in [-3.5, 3.5] {
                span.move(to: .init(x: x, y: -18.5)); span.addLine(to: .init(x: x, y: -12))
            }
            span.move(to: .init(x: -5.6, y: -14)); span.addLine(to: .init(x: 5.6, y: -14))
            span.move(to: .init(x: -5.6, y: -15.5)); span.addLine(to: .init(x: -3.5, y: -18))
            span.addQuadCurve(to: .init(x: 3.5, y: -18), control: .init(x: 0, y: -13.5))
            span.addLine(to: .init(x: 5.6, y: -15.5))
            layer.stroke(span, with: .color(.white), style: .init(lineWidth: 0.95, lineCap: .round))
        } else {
            layer.fill(Path(ellipseIn: .init(x: -2, y: -17.4, width: 4, height: 4)), with: .color(.white))
        }
    }
}
