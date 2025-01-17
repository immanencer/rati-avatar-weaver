{pkgs}: {
  deps = [
    pkgs.gnumake
    pkgs.python3
    pkgs.gcc
    pkgs.pkg-config
    pkgs.openssl
    pkgs.postgresql
  ];
}
