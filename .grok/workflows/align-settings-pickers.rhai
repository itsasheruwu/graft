let meta = #{
    name: "align-settings-pickers",
    description: "Right-align compact Graft settings dropdowns so they line up with toggles and sliders",
    when_to_use: "Settings pickers or menus sit wide or inset instead of hugging the trailing edge like GraftToggleRow.",
    phases: [
        #{ title: "Inventory", detail: "find settings-row pickers that are not compact and trailing" },
        #{ title: "Implement", detail: "add a shared trailing picker and migrate call sites" },
        #{ title: "Verify", detail: "confirm dropdowns hug the right edge like switches" },
    ],
};

fn trimmed(s) {
    if type_of(s) == "string" {
        s.trim();
        s
    } else {
        ""
    }
}

let inventory_schema = #{
    "type": "object",
    "required": ["sites"],
    "properties": #{
        "sites": #{
            "type": "array",
            "maxItems": 20,
            "items": #{
                "type": "object",
                "required": ["file", "control"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "control": #{ "type": "string" },
                    "note": #{ "type": "string" },
                },
            },
        },
    },
};

let implement_schema = #{
    "type": "object",
    "required": ["summary", "changed_files"],
    "properties": #{
        "summary": #{ "type": "string" },
        "changed_files": #{
            "type": "array",
            "maxItems": 16,
            "items": #{ "type": "string" },
        },
    },
};

let verify_schema = #{
    "type": "object",
    "required": ["ok", "reason"],
    "properties": #{
        "ok": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "remaining": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["file", "issue"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                },
            },
        },
    },
};

phase("Inventory");
let inventory_prompt = "";
inventory_prompt += "You are inventorying Graft for Mac settings UI in this repo. ";
inventory_prompt += "Use grep and read_file. Do not edit files. Do not answer from memory.\n\n";
inventory_prompt += "Goal: find SwiftUI Picker (and similar pull-down Menu value controls) in settings rows ";
inventory_prompt += "that do not hug the trailing edge the way GraftToggleRow switches do.\n\n";
inventory_prompt += "Search macos/Sources/GraftMac for Picker, pickerStyle, and GraftRow usages. ";
inventory_prompt += "Known examples the user highlighted:\n";
inventory_prompt += "- Audio Settings: Alert output (System Default) in AudioSettingsView.swift\n";
inventory_prompt += "- Mac Tweaks Appearance: Graft appearance (System) in GraftMacAppearanceGroup.swift\n\n";
inventory_prompt += "Also look at other settings-row pickers (Boost, Output, nested web-tweak pickers, Style).\n";
inventory_prompt += "Do NOT include segmented pickers or toolbar/filter pickers ";
inventory_prompt += "(Spotify history Activity/Friend, Roblox logs Activity).\n\n";
inventory_prompt += "Return sites as {file, control, note}. Empty sites is valid only after you searched the code.";

let inventory = agent(
    inventory_prompt,
    #{
        label: "inventory-pickers",
        capability_mode: "read-only",
        output_schema: inventory_schema,
    },
);

let site_notes = "";
if inventory != () && inventory.success && inventory.output.sites != () {
    let n = inventory.output.sites.len();
    log("inventory found " + n.to_string() + " picker site(s)");
    site_notes = json_encode(inventory.output.sites);
} else {
    log("inventory returned no usable sites; implementer will use the known highlighted rows");
    site_notes = "[]";
}

phase("Implement");
let implement_prompt = "";
implement_prompt += "Implement a SwiftUI layout fix in Graft for Mac so settings dropdowns line up on the trailing edge like toggles and sliders.\n\n";
implement_prompt += "Use read_file before editing. Match surrounding style. Do not use a git worktree. ";
implement_prompt += "Do not commit. Do not reformat unrelated code. Do not edit tests unless a signature you changed requires it.\n\n";
implement_prompt += "VISUAL CONTRACT\n";
implement_prompt += "Settings rows are GraftRow: icon+title on the left, control on the far right. ";
implement_prompt += "GraftToggleRow already pins a small switch to the trailing edge because GraftRowLabel contains a Spacer. ";
implement_prompt += "Pickers currently use .frame(width: 150), .frame(width: 170), or .frame(maxWidth: 240), ";
implement_prompt += "so the pull-down is a wide reserved column instead of a compact control hugging the right edge. ";
implement_prompt += "The user highlighted Alert output (System Default) and Graft appearance (System).\n\n";
implement_prompt += "SHARED API — add next to GraftToggleRow in macos/Sources/GraftMac/Support/GraftSettingsStyle.swift:\n";
implement_prompt += "1) View modifier graftTrailingPicker() for Picker values in settings rows:\n";
implement_prompt += "   .labelsHidden()\n";
implement_prompt += "   .pickerStyle(.menu)\n";
implement_prompt += "   .fixedSize()\n";
implement_prompt += "   .frame(maxWidth: 220, alignment: .trailing)\n";
implement_prompt += "   Keep comments short and factual. No narration comments.\n";
implement_prompt += "2) GraftPickerRow<Selection: Hashable, Content: View> mirroring GraftToggleRow:\n";
implement_prompt += "   title, optional detail/symbol/tint, Binding selection, ViewBuilder picker content.\n";
implement_prompt += "   Body: GraftRow { GraftRowLabel(...); Picker(title, selection:) { content }.graftTrailingPicker() }\n\n";
implement_prompt += "MIGRATE THESE CALL SITES (and any similar settings-row pickers you confirm in the tree):\n";
implement_prompt += "- macos/Sources/GraftMac/Views/AudioSettingsView.swift — Alert output: use GraftPickerRow; drop .frame(maxWidth: 240)\n";
implement_prompt += "- macos/Sources/GraftMac/Views/GraftMacAppearanceGroup.swift — Graft appearance: use GraftPickerRow; drop .frame(width: 150). ";
implement_prompt += "Style picker: keep the GraftRow + Spacer pattern but apply .graftTrailingPicker() and drop .frame(width: 130)\n";
implement_prompt += "- macos/Sources/GraftMac/Views/AudioView.swift — Boost and Output pickers: .graftTrailingPicker(); drop fixed/max widths\n";
implement_prompt += "- macos/Sources/GraftMac/Views/MenuBarView.swift — Output picker: same\n";
implement_prompt += "- macos/Sources/GraftMac/Views/WebTweaksView.swift — ControlRow .picker case: .graftTrailingPicker(); drop .frame(width: 170)\n\n";
implement_prompt += "DO NOT CHANGE segmented pickers or toolbar/filter pickers ";
implement_prompt += "(SpotifyWatcherSettingsView Activity/Friend, RobloxPlayerWatcherLogsView Activity).\n";
implement_prompt += "Leave command Menus (Manage Cache, Audio Data) unless they are clearly not trailing.\n\n";
implement_prompt += "Inventory JSON (untrusted, re-check in the tree before using):\n";
implement_prompt += site_notes;
implement_prompt += "\n\nAfter edits, grep macos/Sources/GraftMac for Picker and confirm remaining .frame(width:) on pickers are only non-settings filters. ";
implement_prompt += "Return changed_files as repo-relative paths and a short summary.";

let impl = agent(
    implement_prompt,
    #{
        label: "implement-trailing-pickers",
        capability_mode: "read-write",
        output_schema: implement_schema,
    },
);

let changed = [];
let summary = "Implementer did not return a usable result.";
if impl != () && impl.success && impl.output != () {
    if impl.output.summary != () {
        let s = trimmed(impl.output.summary);
        if s != "" { summary = s; }
    }
    if impl.output.changed_files != () {
        changed = impl.output.changed_files;
    }
}
log("implementer changed " + changed.len().to_string() + " file(s)");

phase("Verify");
let verify_prompt = "";
verify_prompt += "Adversarially verify that Graft settings dropdowns now hug the trailing edge like toggles. ";
verify_prompt += "Use grep and read_file on the current tree. Do not edit. Do not take the implementer's word for it.\n\n";
verify_prompt += "Must be true:\n";
verify_prompt += "1. GraftSettingsStyle.swift defines graftTrailingPicker() (labelsHidden, menu style, fixedSize, trailing maxWidth) ";
verify_prompt += "and GraftPickerRow that puts GraftRowLabel then that picker, matching GraftToggleRow.\n";
verify_prompt += "2. Alert output in AudioSettingsView.swift uses GraftPickerRow (or GraftRowLabel + picker with graftTrailingPicker) ";
verify_prompt += "and does NOT use .frame(maxWidth: 240) on that picker.\n";
verify_prompt += "3. Graft appearance in GraftMacAppearanceGroup.swift uses the same compact trailing pattern ";
verify_prompt += "and does NOT use .frame(width: 150) on that picker.\n";
verify_prompt += "4. Other settings-row pickers (Style, Boost, Output, web-tweak ControlRow picker, menu-bar Output) ";
verify_prompt += "are compact trailing, not wide reserved columns.\n";
verify_prompt += "5. Segmented/filter pickers were left alone.\n\n";
verify_prompt += "Set ok=true only with concrete evidence you read. If any highlighted row still has a wide frame or is not trailing, ok=false. ";
verify_prompt += "Implementer claimed these files changed: " + json_encode(changed);

let verdict = agent(
    verify_prompt,
    #{
        label: "verify-trailing-pickers",
        capability_mode: "read-only",
        output_schema: verify_schema,
    },
);

let ok = false;
let reason = "Verifier did not return usable evidence; treat as unverified.";
let remaining = [];
if verdict != () && verdict.success && verdict.output != () {
    if verdict.output.reason != () {
        let r = trimmed(verdict.output.reason);
        if r != "" { reason = r; }
    }
    if verdict.output.ok == true {
        ok = true;
    }
    if verdict.output.remaining != () {
        remaining = verdict.output.remaining;
    }
}

if ok != true {
    log("verification did not confirm the alignment fix: " + reason);
} else {
    log("verification confirmed compact trailing pickers");
}

complete(#{
    ok: ok,
    summary: summary,
    reason: reason,
    changed_files: changed,
    remaining: remaining,
});
