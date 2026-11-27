# Install Cluster Autoscaler using HELM

# Resource: Helm Release 
resource "helm_release" "cluster_autoscaler_release" {
  depends_on = [aws_iam_role.cluster-autoscaler]
  name       = var.cluster-autoscaler-ns
  # https://github.com/kubernetes/autoscaler
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"

  namespace = var.cluster-autoscaler-ns
  set = [
    {
      name  = "cloudProvider"
      value = "aws"
    },
    {
      name  = "autoDiscovery.clusterName"
      value = data.aws_eks_cluster.example.name
    },
    {
      name  = "awsRegion"
      value = var.aws_region
    },
    {
      name  = "rbac.serviceAccount.create"
      value = "true"
    },
    {
      name  = "rbac.serviceAccount.name"
      value = var.cluster-autoscaler-sa
    },
    {
      name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
      value = aws_iam_role.cluster-autoscaler.arn
    },
    {
      name  = "extraArgs.scale-down-delay-after-add"
      value = "2m"
    },
    {
      name  = "extraArgs.scale-down-unneeded-time"
      value = "2m"
    },
    {
      name  = "fullnameOverride"
      value = "cluster-autoscaler"
    }
  ]

}
