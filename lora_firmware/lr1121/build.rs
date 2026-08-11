use std::path::PathBuf;

fn main() {
    embuild::espidf::sysenv::relay();
    embuild::espidf::sysenv::output();

    let vendor = PathBuf::from("vendor");
    if !vendor.exists() {
        println!("cargo:warning=lr1121: vendor/ not found — symlink lr11xx_driver here");
        return;
    }

    let inc = vendor.join("src");
    let mut cc = cc::Build::new();
    cc.include(&inc)
        .include(inc.join("common"))
        .flag_if_supported("-Wno-unused-parameter");

    for f in walkdir(&inc) {
        if f.extension().map(|e| e == "c").unwrap_or(false) {
            cc.file(&f);
        }
    }

    cc.compile("lr11xx");
    println!("cargo:rustc-link-lib=static=lr11xx");
    println!("cargo:rerun-if-changed=vendor/");
}

fn walkdir(dir: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() { out.extend(walkdir(&p)); } else { out.push(p); }
        }
    }
    out
}
