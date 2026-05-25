/** Companion 项目路径类错误 → 用户可读文案 */

export function companionProjectErrorMessage(code: string): string {
  switch (code) {
    case "baseDir_not_accessible":
      return "目录不存在或无法读取，请检查路径是否正确";
    case "baseDir_must_be_under_home":
      return "目录须位于用户主目录下（如 ~/Projects/...）";
    case "baseDir_forbidden":
      return "不能绑定系统目录";
    case "baseDir_in_data_dir":
      return "不能绑定 Companion 数据目录，请选择您的课题目录";
    case "baseDir_required":
      return "请填写文件夹路径";
    case "use_import_folder":
      return "请通过「添加新项目」绑定本地文件夹";
    default:
      return code;
  }
}
