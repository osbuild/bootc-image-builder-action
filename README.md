# @bootc-warehouse/bootc-image-builder-action

GitHub Action for building ISOs and disk images for Bootable Containers.

## Scope

This action is intended to be as close to a 1:1 mapping of the
`bootc-image-builder` tool as possible. It is not interested in providing
additional features or functionality beyond what is provided by the
`bootc-image-builder` tool, and therefore these features should be implemented
in the `bootc-image-builder` tool itself. The only exception to this is the
generation of checksums for the built artifacts, since this is a common
requirement for automated workflows.

## Usage

```yaml
- name: Build ISO
  id: build-iso
  uses: bootc-warehouse/bootc-image-builder-action@vX.Y.Z
  with:
    config-file: ./iso-config.toml
    image: quay.io/fedora/fedora-silverblue:latest
    types: |
      iso

- name: Upload Artifact
  uses: actions/upload-artifact@v4
  with:
    name: iso
    path: ${{ steps.build-iso.outputs.output-directory }}
    if-no-files-found: error
```

## Inputs

### `config-file`

Path to the configuration file.

### `image`

The image to use for building the ISO.

### `builder-image` (optional)

The image to use for building the ISO.

Default: `quay.io/centos-bootc/bootc-image-builder:latest`

### `additional-args` (optional)

Additional arguments to pass to the `bootc-image-builder` tool. This can be used
to enable experimental features or to pass additional arguments to the
`bootc-image-builder` tool.

### `chown` (optional)

The user and group to use for the output directory. In the form of `user:group`.

### `rootfs` (optional)

The root filesystem to use for the ISO.

### `tls-verify` (optional)

Whether to verify TLS certificates.

Default: `true`

### `types` (optional)

The types of artifacts to build. Can be any type supported by
[osbuild/bootc-image-builder](https://github.com/osbuild/bootc-image-builder).

Default: `qcow2`

Note: Only non-cloud types are currently tested.

### `aws-ami-name` (optional)

The name of the AMI to create. Only used when `aws` is in `types`.

### `aws-region` (optional)

The region to create the AMI in. Only used when `aws` is in `types`.

### `aws-bucket` (optional)

The name of the S3 bucket to upload the AMI to. Only used when `aws` is in
`types`.

## Outputs

### `output-directory`

The directory containing the built artifacts. Files will be nested in
subdirectories based on the type of artifact.

### `output-paths`

A JSON array of the paths to the built artifacts.

Example (prettified):

```json
{
  "vhd": {
    "type": "vhd",
    "path": "/home/runner/work/bootc-image-builder-action/bootc-image-builder-action/output/vpc/disk.vhd",
    "checksum": "a38c872fb03c93cebd4658a878ecb94a38fabfb913d68570dfeb7e6c39134732"
  },
  "vmdk": {
    "type": "vmdk",
    "path": "/home/runner/work/bootc-image-builder-action/bootc-image-builder-action/output/vmdk/disk.vmdk",
    "checksum": "e6e1ee599a294da25512fb8dbc21b5578f90e6937bd8341669c251a6f64407e1"
  },
  "qcow2": {
    "type": "qcow2",
    "path": "/home/runner/work/bootc-image-builder-action/bootc-image-builder-action/output/qcow2/disk.qcow2",
    "checksum": "fb740cacb1258e061990e832e7a3ff148d9e56dc553013bba891a1f12fd8e73b"
  },
  "raw": {
    "type": "raw",
    "path": "/home/runner/work/bootc-image-builder-action/bootc-image-builder-action/output/image/disk.raw",
    "checksum": "b139fe8b3702291c95de264b01d5a5a342cba6265511dd05c5784dbbdb37a268"
  }
}
```

### `manifest-path`

The path to the manifest file used to build the artifacts.

### `qcow2-output-path`

The path to the qcow2 artifact. If the artifact type was not requested, this
will be an empty string.

### `qcow2-output-checksum`

The checksum of the qcow2 artifact. If the artifact type was not requested, this
will be an empty string.

### `vmdk-output-path`

The path to the VMDK artifact. If the artifact type was not requested, this will
be an empty string.

### `vmdk-output-checksum`

The checksum of the VMDK artifact. If the artifact type was not requested, this
will be an empty string.

### `anaconda-iso-output-path`

The path to the Anaconda ISO artifact. If the artifact type was not requested,
this will be an empty string.

### `anaconda-iso-output-checksum`

The checksum of the Anaconda ISO artifact. If the artifact type was not
requested, this will be an empty string.

### `raw-output-path`

The path to the raw artifact. If the artifact type was not requested, this will
be an empty string.

### `raw-output-checksum`

The checksum of the raw artifact. If the artifact type was not requested, this
will be an empty string.

### `vhd-output-path`

The path to the VHD artifact. If the artifact type was not requested, this will
be an empty string.

### `vhd-output-checksum`

The checksum of the VHD artifact. If the artifact type was not requested, this
will be an empty string.

## License

This project is licensed under the Apache License, Version 2.0 - see the
[LICENSE](./LICENSE) file for details.
